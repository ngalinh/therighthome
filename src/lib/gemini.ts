import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export type CCCDOCRResult = {
  idNumber?: string;
  fullName?: string;
  dateOfBirth?: string; // ISO yyyy-mm-dd if possible
  gender?: string;
  hometown?: string;
  permanentAddress?: string;
  raw?: string;
};

const PROMPT = `Trích xuất thông tin từ ảnh CCCD/CMND Việt Nam.
Trả về JSON với các khoá sau (giá trị là chuỗi, để rỗng nếu không đọc được):
- idNumber: số CCCD (12 chữ số) hoặc CMND (9 chữ số)
- fullName: họ và tên (in hoa nguyên văn)
- dateOfBirth: ngày sinh dạng YYYY-MM-DD (chuyển từ DD/MM/YYYY)
- gender: "Nam" hoặc "Nữ"
- hometown: quê quán
- permanentAddress: nơi thường trú

Chỉ trả về JSON thuần, không markdown, không giải thích.`;

export async function extractCCCD(images: { mimeType: string; data: string }[]): Promise<CCCDOCRResult> {
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  });
  let res;
  try {
    res = await model.generateContent([
      { text: PROMPT },
      ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Gemini] generateContent failed:", { model: modelName, error: msg });
    throw new Error(`Gemini API lỗi (${modelName}): ${msg}`);
  }
  const text = res.response.text();
  try {
    const parsed = JSON.parse(text) as CCCDOCRResult;
    return { ...parsed, raw: text };
  } catch {
    return { raw: text };
  }
}
