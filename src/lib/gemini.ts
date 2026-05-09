import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export type CCCDOCRResult = {
  idNumber?: string;
  fullName?: string;
  dateOfBirth?: string; // ISO yyyy-mm-dd if possible
  gender?: string;
  hometown?: string;
  permanentAddress?: string;
  idIssuedDate?: string; // ISO yyyy-mm-dd if possible (Ngày cấp from CCCD back)
  raw?: string;
};

const PROMPT = `Trích xuất thông tin từ ảnh CCCD/CMND Việt Nam (có thể có ảnh mặt trước, mặt sau, hoặc cả hai).
Trả về JSON với các khoá sau (giá trị là chuỗi, để rỗng "" nếu không đọc được):
- idNumber: số CCCD (12 chữ số) hoặc CMND (9 chữ số), nằm ở MẶT TRƯỚC dưới dòng "Số / No.".
- fullName: họ và tên IN HOA, MẶT TRƯỚC dưới dòng "Họ và tên / Full name".
- dateOfBirth: ngày sinh dạng YYYY-MM-DD (chuyển từ DD/MM/YYYY), MẶT TRƯỚC dưới dòng "Ngày sinh / Date of birth".
- gender: "Nam" hoặc "Nữ" (đọc từ "Giới tính / Sex" ở MẶT TRƯỚC).
- hometown: quê quán/nguyên quán, MẶT TRƯỚC dưới dòng "Quê quán / Place of origin".
- permanentAddress: nơi thường trú, BẮT BUỘC TÌM KỸ. Trên CCCD chip mới nằm ở MẶT TRƯỚC dưới dòng "Nơi thường trú / Place of residence" (thường 2 dòng, ghép lại đầy đủ kèm phường/xã, quận/huyện, tỉnh/thành phố). Trên CMND/CCCD cũ nằm ở MẶT SAU dưới dòng "Nơi đăng ký hộ khẩu thường trú".
- idIssuedDate: ngày cấp CCCD dạng YYYY-MM-DD. BẮT BUỘC TÌM KỸ ở MẶT SAU: tìm dòng "Ngày, tháng, năm / Date, month, year" — phía dưới hoặc bên cạnh là 3 số DD MM YYYY (hoặc DD/MM/YYYY). Trên CMND cũ là dòng có chữ "Ngày cấp" hoặc ngay dưới chữ ký/dấu của cơ quan cấp. Chuyển sang YYYY-MM-DD.

Quan trọng: KHÔNG được bỏ trống permanentAddress và idIssuedDate nếu thông tin có trong ảnh — đọc kỹ cả hai mặt trước khi trả "".
Chỉ trả về JSON thuần, không markdown, không giải thích.`;

export async function extractCCCD(images: { mimeType: string; data: string }[]): Promise<CCCDOCRResult> {
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
