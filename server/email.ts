// Email service using Resend integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

export async function getResendClient() {
  const credentials = await getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (result.error) {
      console.error('Resend error:', result.error);
      return { success: false, error: result.error.message };
    }

    console.log('Email sent successfully to:', params.to);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

export function generateCredentialsEmailHtml(params: {
  email: string;
  password: string;
  licenseKey: string;
  appUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your IFRS 15 Access Credentials</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">IFRS 15 Revenue Manager</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Welcome to your account</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">Your account has been created. Here are your login credentials:</p>
    
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 120px;">Email:</td>
          <td style="padding: 8px 0; font-weight: 600;">${params.email}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Password:</td>
          <td style="padding: 8px 0; font-weight: 600; font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${params.password}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">License Key:</td>
          <td style="padding: 8px 0; font-weight: 600; font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${params.licenseKey}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.appUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Access Your Account</a>
    </div>
    
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-top: 20px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>Important:</strong> For security, please change your password after your first login. Your license is locked to one IP address at a time.
      </p>
    </div>
  </div>
  
  <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin: 0; color: #6b7280; font-size: 12px;">
      This email was sent by IFRS 15 Revenue Manager.<br>
      If you did not request this account, please ignore this email.
    </p>
  </div>
</body>
</html>
  `;
}

export function generateCredentialsEmailText(params: {
  email: string;
  password: string;
  licenseKey: string;
  appUrl: string;
}): string {
  return `
Welcome to IFRS 15 Revenue Manager!

Your login credentials:
- Email: ${params.email}
- Password: ${params.password}
- License Key: ${params.licenseKey}

Please login at: ${params.appUrl}

Important: For security, please change your password after first login.
Note: Your license is locked to one IP address at a time.
  `.trim();
}
