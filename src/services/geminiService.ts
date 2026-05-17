import { GoogleGenAI, Type } from "@google/genai";
import { Room, Tenant, Invoice, UtilityReading, Notification, User } from "../types";

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function getAIResponse(
  prompt: string,
  history: AIChatMessage[],
  context: {
    rooms: Room[];
    tenants: Tenant[];
    invoices: Invoice[];
    readings: UtilityReading[];
    currentUser: User;
  }
) {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return "Vui lòng cấu hình GEMINI_API_KEY trong phần Secrets để sử dụng AI.";
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview"; // Switch back to Flash to avoid quota issues (429)
  
  const systemInstruction = `
    Bạn là Trợ lý Quản lý Nhà trọ Thông minh (AI Admin). 
    Bạn giúp chủ trọ (Admin) quản lý nhà trọ một cách hiệu quả.
    
    Dữ liệu hiện tại của hệ thống:
    - Số lượng phòng: ${context.rooms.length}
    - Số lượng người thuê: ${context.tenants.length}
    - Số hóa đơn: ${context.invoices.length}
    - Số bản ghi điện nước: ${context.readings.length}
    
    Nhiệm vụ của bạn:
    1. Trả lời các câu hỏi về dữ liệu (doanh thu, công nợ, chỉ số điện nước).
    2. Phân tích trạng thái phòng (trống, đã thuê, số lượng người ở mỗi phòng).
    3. Theo dõi tình trạng thanh toán (phòng nào đã đóng, phòng nào chưa đóng).
    
    Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. 
    Sử dụng các công cụ (tools) được cung cấp để lấy thông tin chính xác nhất.
    Nếu người dùng hỏi về "phòng ở mấy người", hãy dùng get_occupancy_stats.
    Nếu hỏi về "phòng trống" hay "phòng đã thuê", hãy dùng get_room_availability.
    Nếu hỏi về "thanh toán", "nợ", "hóa đơn", hãy dùng get_payment_status hoặc get_revenue_summary.
    Nếu hỏi về "dùng nhiều điện/nước", hãy dùng get_high_utility_usage.
  `;

  const tools = [
    {
      functionDeclarations: [
        {
          name: "get_payment_status",
          description: "Lấy danh sách các phòng đã thanh toán hoặc chưa thanh toán trong một tháng.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, enum: ["PAID", "UNPAID", "OVERDUE"], description: "Trạng thái thanh toán cần kiểm tra." },
              month: { type: Type.STRING, description: "Tháng cần kiểm tra (YYYY-MM). Mặc định là tháng hiện tại." }
            },
            required: ["status"]
          }
        },
        {
          name: "get_room_availability",
          description: "Lấy danh sách các phòng đang trống hoặc đã được thuê.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, enum: ["VACANT", "OCCUPIED"], description: "Trạng thái phòng cần kiểm tra." }
            },
            required: ["status"]
          }
        },
        {
          name: "get_occupancy_stats",
          description: "Lấy thông tin về số lượng người đang ở trong mỗi phòng.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              occupantCount: { type: Type.NUMBER, description: "Lọc các phòng có đúng số lượng người này." }
            }
          }
        },
        {
          name: "get_revenue_summary",
          description: "Tính toán tổng doanh thu đã thu và doanh thu còn nợ của một tháng.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              month: { type: Type.STRING, description: "Tháng cần tính toán (YYYY-MM)." }
            }
          }
        },
        {
          name: "get_high_utility_usage",
          description: "Tìm các phòng có mức tiêu thụ điện hoặc nước cao vượt ngưỡng.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ["ELECTRICITY", "WATER"], description: "Loại tiện ích cần kiểm tra." },
              threshold: { type: Type.NUMBER, description: "Ngưỡng tiêu thụ (ví dụ: 100 số điện hoặc 10 khối nước)." },
              month: { type: Type.STRING, description: "Tháng cần kiểm tra (YYYY-MM)." }
            },
            required: ["type", "threshold"]
          }
        }
      ]
    }
  ];

  const trimmedHistory = history.slice(-10);
  const contents: any[] = [
    ...trimmedHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  try {
    let response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        tools: tools as any
      },
    });

    // Handle function calls loop
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && iterations < MAX_ITERATIONS) {
      iterations++;
      const currentContent = response.candidates[0].content;
      contents.push(currentContent);

      const functionCalls = currentContent.parts.filter(p => p.functionCall);
      const functionResponses = [];

      for (const part of functionCalls) {
        const call = part.functionCall!;
        let result;
        const args = call.args as any;
        
        if (call.name === "get_payment_status") {
          const month = args.month || new Date().toISOString().slice(0, 7);
          const status = args.status;
          const filtered = context.invoices.filter(inv => inv.month === month && inv.status === status);
          result = filtered.map(inv => ({
            room: context.rooms.find(r => r.id === inv.roomId)?.name,
            amount: inv.total,
            dueDate: inv.dueDate
          }));
        } else if (call.name === "get_room_availability") {
          const status = args.status;
          const filtered = context.rooms.filter(r => r.status === status);
          result = filtered.map(r => ({ name: r.name, price: r.price }));
        } else if (call.name === "get_occupancy_stats") {
          const count = args.occupantCount;
          const roomOccupancy = context.rooms.map(room => {
            const occupants = context.tenants.filter(t => t.roomId === room.id).length;
            return { name: room.name, occupants };
          });
          result = count !== undefined ? roomOccupancy.filter(r => r.occupants === count) : roomOccupancy;
        } else if (call.name === "get_revenue_summary") {
          const month = args.month || new Date().toISOString().slice(0, 7);
          const monthInvoices = context.invoices.filter(inv => inv.month === month);
          const paid = monthInvoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + inv.total, 0);
          const unpaid = monthInvoices.filter(inv => inv.status !== 'PAID').reduce((sum, inv) => sum + inv.total, 0);
          result = { paid, unpaid, total: paid + unpaid };
        } else if (call.name === "get_high_utility_usage") {
          const { type, threshold, month } = args;
          const targetMonth = month || new Date().toISOString().slice(0, 7);
          const readings = context.readings.filter(r => r.month === targetMonth);
          
          result = readings.map(r => {
            const usage = type === 'ELECTRICITY' 
              ? r.electricityIndex - r.previousElectricityIndex 
              : r.waterIndex - r.previousWaterIndex;
            return {
              room: context.rooms.find(room => room.id === r.roomId)?.name,
              usage,
              type
            };
          }).filter(r => r.usage >= threshold);
        }

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result },
            id: call.id
          }
        });
      }

      contents.push({
        role: 'user',
        parts: functionResponses
      });

      response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          tools: tools as any
        },
      });
    }

    return response.text || "Tôi không tìm thấy thông tin phù hợp.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    const errorMessage = error?.message || String(error);
    
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      return "Hệ thống AI đang quá tải hoặc bạn đã hết hạn mức (quota) miễn phí. Vui lòng đợi một lát rồi thử lại, hoặc kiểm tra cấu hình API key.";
    }
    
    return `Đã có lỗi xảy ra: ${errorMessage.slice(0, 150)}... Vui lòng thử lại sau.`;
  }
}
