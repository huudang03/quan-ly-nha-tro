import nodemailer from 'nodemailer';

export class EmailService {
  private static getTransporter(config?: any) {
    const host = config?.smtpHost || process.env.SMTP_HOST;
    const port = parseInt(config?.smtpPort || process.env.SMTP_PORT || '587');
    const user = config?.smtpUser || process.env.SMTP_USER;
    const pass = config?.smtpPass || process.env.SMTP_PASS;

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  static async sendResetPasswordEmail(email: string, token: string, config?: any, baseUrl?: string) {
    const fallbackUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
    const appUrl = baseUrl || process.env.APP_URL || process.env.CLIENT_URL || fallbackUrl;
    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const from = config?.smtpFrom || process.env.SMTP_FROM || '"Quản lý nhà trọ" <noreply@boardingpro.com>';

    const mailOptions = {
      from,
      to: email,
      subject: 'Đặt lại mật khẩu',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
          <h2 style="color: #18181b; margin-bottom: 16px;">Đặt lại mật khẩu</h2>
          <p style="color: #52525b; line-height: 1.5;">Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình. Nhấn vào nút bên dưới để tiếp tục:</p>
          <div style="margin: 32px 0; text-align: center;">
            <a href="${resetUrl}" style="background-color: #18181b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Đặt lại mật khẩu</a>
          </div>
          <p style="color: #71717a; font-size: 14px;">Link này sẽ hết hạn sau 15 phút. Nếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này.</p>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #a1a1aa; font-size: 12px;">Quản lý nhà trọ - Hệ thống quản lý phòng trọ chuyên nghiệp</p>
        </div>
      `,
    };

    try {
      const host = config?.smtpHost || process.env.SMTP_HOST;
      if (!host) {
        console.warn('[EMAIL SERVICE] SMTP_HOST is not configured. Email will not be sent.');
        console.log('--- RESET PASSWORD LINK (DEBUG) ---');
        console.log(`Email: ${email}`);
        console.log(`Link: ${resetUrl}`);
        console.log('-----------------------------------');
        return;
      }
      
      const transporter = this.getTransporter(config);
      
      // Verify connection
      try {
        await transporter.verify();
        console.log('[EMAIL SERVICE] SMTP connection verified successfully');
      } catch (verifyErr) {
        console.error('[EMAIL SERVICE] SMTP verify error:', verifyErr);
        // Continue anyway as verify can be strict
      }

      await transporter.sendMail(mailOptions);
      console.log(`[EMAIL SERVICE] Reset password email sent to ${email}`);
    } catch (error) {
      console.error('[EMAIL SERVICE] Error sending reset password email:', error);
      console.log('--- FALLBACK RESET PASSWORD LINK (DEBUG) ---');
      console.log(`Email: ${email}`);
      console.log(`Link: ${resetUrl}`);
      console.log('-------------------------------------------');
      throw error;
    }
  }
}
