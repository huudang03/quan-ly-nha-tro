# Hướng dẫn chạy backend MySQL

1. Chắc chắn bạn đã cài đặt MySQL Server (ví dụ XAMPP, MySQL Community Server, v.v.).

2. Cập nhật file `.env`:
Sao chép `.env.example` thành `.env` (nếu chưa có).
Tìm dòng `DATABASE_URL` và chỉnh lại thành URI kết nối MySQL của bạn.
Ví dụ: `DATABASE_URL="mysql://root:password@localhost:3306/quanlynhatro"`
(Nếu dùng XAMPP MySQL không pass, url sẽ là: `mysql://root:@localhost:3306/quanlynhatro`)

3. Di chuyển vào thư mục project, cài đặt thư viện:
`npm install`

4. Chạy script tạo Database & Schema (mặc định lấy theo DATABASE_URL):
`npx tsx initDb.ts`
(Script sẽ tạo database tên là "quanlynhatro" hoặc theo tên cấu hình, đồng thời tạo đầy đủ bảng và khóa ngoại)

5. Chạy project:
`npm run dev`

Lưu ý: Format API trước đây vẫn được giữ nguyên nên frontend gọi API không hề thay đổi. MySQL Pool connection được cấu hình tại `src/config/db.ts`.
