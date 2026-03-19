/** Send a magic link email via Resend API */
export async function sendMagicLink(
  email: string,
  link: string,
  resendApiKey: string,
): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "8EyeTieDye <noreply@8eyetiedye.com>",
      to: [email],
      subject: "Sign in to 8EyeTieDye",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 16px;">Sign in to 8EyeTieDye</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Click the button below to sign in. This link expires in 15 minutes.
          </p>
          <a href="${link}" style="display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px;">
            Sign In
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 24px; line-height: 1.4;">
            If you didn't request this link, you can safely ignore this email.
          </p>
          <p style="color: #ccc; font-size: 12px; margin-top: 32px;">
            8EyeTieDye — AI-generated tie-dye designs
          </p>
        </div>
      `,
      text: `Sign in to 8EyeTieDye\n\nClick here to sign in: ${link}\n\nThis link expires in 15 minutes. If you didn't request this, ignore this email.`,
    }),
  });

  return res.ok;
}
