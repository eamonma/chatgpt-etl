export interface FetchRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

export interface FetchResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface ChatGptClient {
  fetch(req: FetchRequest): Promise<FetchResponse>;
}
