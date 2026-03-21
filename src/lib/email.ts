interface OrderItem {
  productName: string;
  designName: string;
  size: string;
  priceCents: number;
}

/** Send an order confirmation email via Resend API */
export async function sendOrderConfirmation(
  email: string,
  orderGroupId: string,
  items: OrderItem[],
  totalCents: number,
  siteUrl: string,
  resendApiKey: string,
): Promise<boolean> {
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const itemRows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${item.productName}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">${item.designName}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">${item.size}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333; text-align: right;">${formatPrice(item.priceCents)}</td>
        </tr>`,
    )
    .join("");

  const itemsText = items
    .map(
      (item) =>
        `- ${item.productName} (${item.designName}, ${item.size}) — ${formatPrice(item.priceCents)}`,
    )
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "8EyeTieDye <noreply@8eyetiedye.com>",
      to: [email],
      subject: "Order Confirmed — 8EyeTieDye",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 8px;">Order Confirmed!</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
            Thanks for your order. Your unique tie-dye items are being produced now.
          </p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid #eee;">
                <th style="text-align: left; padding: 8px 0; color: #999; font-weight: 600;">Item</th>
                <th style="text-align: left; padding: 8px 0; color: #999; font-weight: 600;">Design</th>
                <th style="text-align: left; padding: 8px 0; color: #999; font-weight: 600;">Size</th>
                <th style="text-align: right; padding: 8px 0; color: #999; font-weight: 600;">Price</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <p style="font-size: 16px; font-weight: 600; color: #1a1a2e; text-align: right; margin-bottom: 24px;">
            Total: ${formatPrice(totalCents)}
          </p>
          <a href="${siteUrl}/order/${orderGroupId}" style="display: inline-block; background: #7c3aed; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px;">
            Track Your Order
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 24px; line-height: 1.4;">
            Production typically takes 3–7 business days. You'll receive tracking info once your order ships.
          </p>
          <p style="color: #ccc; font-size: 12px; margin-top: 32px;">
            8EyeTieDye — AI-generated tie-dye designs
          </p>
        </div>
      `,
      text: `Order Confirmed — 8EyeTieDye\n\nThanks for your order! Your unique tie-dye items are being produced now.\n\n${itemsText}\n\nTotal: ${formatPrice(totalCents)}\n\nTrack your order: ${siteUrl}/order/${orderGroupId}\n\nProduction typically takes 3-7 business days. You'll receive tracking info once your order ships.`,
    }),
  });

  return res.ok;
}

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
