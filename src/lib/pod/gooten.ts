interface GootenOrderItem {
  SKU: string;
  ShipCarrierMethodId: number;
  Quantity: number;
  Images: {
    Url: string;
    Index: number;
    ManipCommand: string;
    SpaceId: string;
  }[];
}

interface GootenShipToAddress {
  FirstName: string;
  LastName: string;
  Line1: string;
  Line2?: string;
  City: string;
  State: string;
  CountryCode: string;
  PostalCode: string;
  Email: string;
  Phone: string;
}

interface GootenOrderResponse {
  Id: string;
  NiceId: string;
  Items: { Id: string; Status: string }[];
}

export async function createGootenOrder(
  apiKey: string,
  shipTo: GootenShipToAddress,
  items: GootenOrderItem[],
  externalId?: string,
): Promise<GootenOrderResponse> {
  const res = await fetch(
    `https://api.gooten.com/v/4/source/api/orders/?recipeid=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ShipToAddress: shipTo,
        Items: items,
        Payment: {
          PartnerBillingKey: apiKey,
          CurrencyCode: "USD",
        },
        Meta: {
          ExternalId: externalId,
        },
        IsPreSubmit: false,
      }),
    },
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gooten order failed: ${res.status} ${error}`);
  }

  return res.json() as Promise<GootenOrderResponse>;
}
