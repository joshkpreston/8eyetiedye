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

function buildHeaders(apiKey: string, storeId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (storeId) {
    headers["X-PF-Store-Id"] = storeId;
  }
  return headers;
}

export async function createPrintfulOrder(
  apiKey: string,
  recipient: PrintfulRecipient,
  items: PrintfulOrderItem[],
  externalId?: string,
  storeId?: string,
): Promise<PrintfulOrderResponse> {
  const res = await fetch("https://api.printful.com/orders", {
    method: "POST",
    headers: buildHeaders(apiKey, storeId),
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
  storeId?: string,
): Promise<PrintfulOrderResponse> {
  const res = await fetch(`https://api.printful.com/orders/${orderId}`, {
    headers: buildHeaders(apiKey, storeId),
  });

  if (!res.ok) {
    throw new Error(`Printful order lookup failed: ${res.status}`);
  }

  return res.json() as Promise<PrintfulOrderResponse>;
}
