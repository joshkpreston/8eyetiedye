interface PrintfulOrderItem {
  variant_id: number;
  quantity: number;
  files: {
    type: string;
    url: string;
  }[];
}

interface PrintfulRecipient {
  name: string;
  address1: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  email: string;
}

interface PrintfulOrderResponse {
  code: number;
  result: {
    id: number;
    status: string;
    shipping: string;
    created: number;
  };
}

export async function createPrintfulOrder(
  apiKey: string,
  recipient: PrintfulRecipient,
  items: PrintfulOrderItem[],
  externalId?: string,
): Promise<PrintfulOrderResponse> {
  const res = await fetch("https://api.printful.com/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: externalId,
      recipient,
      items,
      confirm: true,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Printful order failed: ${res.status} ${error}`);
  }

  return res.json() as Promise<PrintfulOrderResponse>;
}

export async function getPrintfulOrder(
  apiKey: string,
  orderId: string,
): Promise<PrintfulOrderResponse> {
  const res = await fetch(`https://api.printful.com/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Printful order lookup failed: ${res.status}`);
  }

  return res.json() as Promise<PrintfulOrderResponse>;
}
