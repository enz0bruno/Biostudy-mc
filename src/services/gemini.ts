import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { QuizQuestion, StudyContent } from "../types";

export async function generateStudyContent(
  topic: string, 
  imagesBase64?: string[], 
  outputType: 'Resumo' | 'Trabalho' | 'Lição' | 'Imagens' = 'Resumo'
): Promise<StudyContent> {
  // Create a new instance right before the call to use the latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Special handling for "Imagens" type (Generation or Editing)
  if (outputType === 'Imagens') {
    const contents: any[] = [];
    
    if (imagesBase64 && imagesBase64.length > 0) {
      // Editing Mode
      imagesBase64.forEach(img => {
        contents.push({
          inlineData: {
            mimeType: "image/png",
            data: img.split(',')[1] || img
          }
        });
      });
      contents.push({
        text: `Você é um especialista em edição de diagramas médicos e científicos. 
        Instrução da Maria Clara: "${topic}". 
        Aplique as alterações solicitadas (como adicionar setas, legendas, destacar áreas ou explicar partes) diretamente na imagem. 
        Retorne a imagem editada com altíssima qualidade e fidelidade científica.`
      });
    } else {
      // Generation Mode
      contents.push({
        text: `Gere um diagrama científico/médico de altíssima qualidade sobre: "${topic}". 
        O diagrama deve ser em Português (PT-BR), com legendas claras, fundo branco e estilo de ilustração profissional. 
        Foco total na precisão para estudantes de Biomedicina.`
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: contents },
      config: { 
        imageConfig: { 
          aspectRatio: "16:9"
        } 
      }
    });

    const images: string[] = [];
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        images.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    }

    return {
      summary: imagesBase64 && imagesBase64.length > 0 
        ? "Aqui está a sua imagem editada conforme solicitado." 
        : `Aqui está o diagrama gerado sobre ${topic}.`,
      images,
      quiz: [],
      type: 'Imagens'
    };
  }

  const isGeneralOption = topic.includes('Opção Livre');
  
  // 1. Generate Summary and Quiz Structure
  const contents: any[] = [
    {
      text: `Você é um tutor de elite para Maria Clara Mendonça. Seja extremamente rápido e preciso.
      Tema: "${topic}". Tipo: **${outputType.toUpperCase()}**.
      
      Instruções:
      - **Resumo**: Síntese direta e poderosa.
      - **Trabalho**: Profundidade acadêmica e estrutura formal.
      - **Lição**: Passo a passo didático.
      
      Gere:
      1. Conteúdo Markdown COMPLETO. Use placeholders "![Diagrama 1](img_1)" e "![Diagrama 2](img_2)".
      2. Simulado com 5 questões.
      3. 2 Prompts de imagem em INGLÊS. Os prompts devem ser: "Scientific educational diagram of [specific sub-topic], clear labels IN PORTUGUESE (PT-BR), medical illustration style, white background, high detail". Garanta que o prompt seja EXTREMAMENTE RELEVANTE ao tema central.
      
      Linguagem: Português (Brasil). Nível: Universitário.`
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
    contents[0].text += `\n\nAnalise as imagens enviadas e use-as como base.`;
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
                type: { type: Type.STRING, enum: ["multiple-choice", "true-false", "open-ended"] },
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
  let finalSummary = data.summary || "Erro ao gerar conteúdo.";
  const images: string[] = [];

  if (data.imagePrompts && Array.isArray(data.imagePrompts) && data.imagePrompts.length > 0) {
    const imagePromises = data.imagePrompts.slice(0, 2).map(async (prompt: string, index: number) => {
      try {
        const imgResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: prompt }] },
          config: { 
            imageConfig: { 
              aspectRatio: "16:9"
            } 
          }
        });
        
        const part = imgResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        const base64 = part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
        return { index: index + 1, base64 };
      } catch (e: any) {
        console.error("Image generation failed:", e);
        return { index: index + 1, base64: null };
      }
    });

    const results = await Promise.all(imagePromises);
    results.forEach(res => {
      if (res.base64) {
        images.push(res.base64);
        finalSummary = finalSummary.replace(`img_${res.index}`, res.base64);
      } else {
        finalSummary = finalSummary.replace(`![Diagrama ${res.index}](img_${res.index})`, "");
      }
    });
  }

  return {
    summary: finalSummary,
    images,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
    type: outputType
  };
}
