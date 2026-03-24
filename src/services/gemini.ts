import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { QuizQuestion, StudyContent } from "../types";

export async function generateStudyContent(
  topic: string, 
  imagesBase64?: string[], 
  outputType: 'Resumo' | 'Trabalho' | 'Lição' | 'Imagens' = 'Resumo'
): Promise<StudyContent> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  if (outputType === 'Imagens') {
    const contents: any[] = [];
    
    if (imagesBase64 && imagesBase64.length > 0) {
      imagesBase64.forEach(img => {
        contents.push({
          inlineData: {
            mimeType: "image/png",
            data: img.split(',')[1] || img
          }
        });
      });
      contents.push({
        text: `Você é um especialista em edição de diagramas médicos e científicos. Instrução: "${topic}". Retorne a imagem editada.`
      });
    } else {
      contents.push({
        text: `Gere um diagrama científico/médico de altíssima qualidade sobre: "${topic}". Fundo branco, legendas em PT-BR.`
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: contents },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    const images: string[] = [];
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        images.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }

    return {
      summary: images.length > 0 ? "Aqui está o seu diagrama." : "Não foi possível gerar a imagem.",
      images,
      quiz: [],
      type: 'Imagens'
    };
  }

  const contents: any[] = [
    {
      text: `Você é um tutor para Maria Clara Mendonça. Tema: "${topic}". Tipo: ${outputType}.
      Gere: 1. Resumo Markdown. 2. 5 questões de simulado. 3. 2 prompts de imagem em inglês.
      Retorne APENAS um JSON com as chaves: summary, imagePrompts, quiz.`
    }
  ];

  if (imagesBase64 && imagesBase64.length > 0) {
    imagesBase64.forEach(img => {
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: img.split(',')[1] || img
        }
      });
    });
  }

  const textResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["type", "question", "correctAnswer", "explanation"]
            }
          }
        },
        required: ["summary", "imagePrompts", "quiz"]
      }
    }
  });

  const data = JSON.parse(textResponse.text || "{}");
  const images: string[] = [];

  if (data.imagePrompts && Array.isArray(data.imagePrompts) && data.imagePrompts.length > 0) {
    const imagePromises = data.imagePrompts.slice(0, 2).map(async (prompt: string) => {
      try {
        const imgResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: prompt }] },
          config: { imageConfig: { aspectRatio: "16:9" } }
        });
        const part = imgResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
      } catch (e) { return null; }
    });

    const results = await Promise.all(imagePromises);
    results.forEach(res => { if (res) images.push(res); });
  }

  return {
    summary: data.summary,
    images,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
    type: outputType
  };
}
