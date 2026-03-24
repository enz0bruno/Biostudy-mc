import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { QuizQuestion, StudyContent, Message } from "../types";

export async function generateStudyContent(
  query: string, 
  imagesBase64?: string[], 
  outputType: 'Resumo' | 'Trabalho' | 'Lição' | 'Imagens' | 'Desabafo' = 'Lição',
  history: Message[] = [],
  onChunk?: (chunk: string) => void
): Promise<StudyContent> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

  // Determine the original topic from history or current query
  const originalTopic = history.length > 0 ? (history[0].text) : query;

  if (outputType === 'Desabafo') {
    const systemInstruction = `Você é um espaço seguro e acolhedor para Maria Clara Mendonça desabafar. 
      Sua missão é ouvir com empatia, oferecer apoio emocional, ser gentil e nunca julgar. 
      Responda de forma humana, carinhosa e atenciosa. 
      Não dê conselhos médicos ou profissionais, apenas seja um ombro amigo. 
      Mantenha as respostas focadas no bem-estar dela. 
      Use uma linguagem acolhedora e reconfortante.`;

    const contents: any[] = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: query }]
    });

    let fullResponse = "";
    const streamResponse = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      }
    });

    for await (const chunk of streamResponse) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        if (onChunk) onChunk(fullResponse);
      }
    }

    return {
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      topic: "Meu Canto de Desabafo",
      summary: fullResponse,
      images: [],
      quiz: [],
      type: 'Desabafo',
      history: [
        ...history,
        { role: 'user', text: query },
        { role: 'model', text: fullResponse }
      ]
    };
  }

  if (outputType === 'Imagens') {
    // ... (image logic stays the same)
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
        text: `Você é um especialista em edição de diagramas médicos e científicos. Instrução: "${query}". Retorne a imagem editada. NÃO ADICIONE TEXTO EXPLICATIVO.`
      });
    } else {
      contents.push({
        text: `Gere um diagrama científico/médico de altíssima qualidade sobre: "${query}". Fundo branco, legendas em PT-BR. APENAS A IMAGEM, SEM TEXTO ADICIONAL.`
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
      id: Math.random().toString(36).substring(7),
      topic: query,
      summary: "", 
      images,
      quiz: [],
      type: 'Imagens',
      timestamp: Date.now(),
      history: [...history, { role: 'user', text: query }, { role: 'model', text: "Imagem gerada." }]
    };
  }

  const systemInstruction = `Você é um tutor especializado para Maria Clara Mendonça. 
      Tema Principal: "${originalTopic}". 
      Tipo de Saída Solicitado: ${outputType}.
      
      INSTRUÇÕES CRÍTICAS DE FORMATO E CONTEÚDO:
      
      - VOCÊ ESTÁ EM UM CHAT. O usuário pode pedir correções, adições ou mudanças. Responda sempre mantendo o contexto.
      - INDEPENDENTE DO TIPO (Resumo, Lição ou Trabalho), você deve entregar o MÁXIMO de conteúdo possível. Seja extremamente detalhado, profundo e extenso por padrão.
      - NÃO ECONOMIZE PALAVRAS. Se o tema for amplo, escreva tudo o que for relevante.
      - Só diminua ou resuma se o usuário pedir explicitamente para "resumir mais" ou "diminuir".
      
      1. LIÇÃO (Tipo: 'Lição'): 
         - Crie uma LIÇÃO COMPLETA E ESTRUTURADA.
         - Deve conter: Introdução Motivadora, Objetivos de Aprendizagem, Explicação Teórica Passo a Passo (MUITO DETALHADA), Exemplos Práticos, Curiosidades e uma Conclusão/Resumo Final.
         - A lição deve ser longa o suficiente para uma sessão de estudo de 30-60 minutos.

      2. TRABALHO (Tipo: 'Trabalho'):
         - Crie um "MEGA TRABALHO" acadêmico completo. 
         - NÃO SE LIMITE. Entregue o MÁXIMO de conteúdo possível (mínimo de 1500-2000 palavras se o tema permitir).
         - Estrutura: Capa Sugerida, Sumário, Introdução, Desenvolvimento Extenso (dividido em vários tópicos e subtópicos detalhados), Análise Crítica, Conclusão e Referências Bibliográficas.

      3. RESUMO (Tipo: 'Resumo'):
         - Mesmo sendo um resumo, deve ser COMPLETO e abranger todos os pontos importantes com profundidade, usando tópicos, tabelas (se aplicável) e explicações claras.`;

  const contents: any[] = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: query }]
  });

  // Step 1: Stream the Summary
  let fullSummary = "";
  const streamResponse = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    }
  });

  for await (const chunk of streamResponse) {
    const text = chunk.text;
    if (text) {
      fullSummary += text;
      if (onChunk) onChunk(fullSummary);
    }
  }

  // Step 2: Generate Metadata (Quiz and Image Prompts)
  const metadataResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...contents,
      { role: 'model', parts: [{ text: fullSummary }] },
      { role: 'user', parts: [{ text: "Agora, com base no conteúdo acima, gere 5 questões de simulado e 2 prompts de imagem em inglês para ilustrar. Retorne APENAS um JSON com as chaves 'quiz' e 'imagePrompts'." }] }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
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
        required: ["imagePrompts", "quiz"]
      }
    }
  });

  const data = JSON.parse(metadataResponse.text || "{}");
  const images: string[] = [];

  // Step 3: Generate Images
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

  const newHistory: Message[] = [
    ...history,
    { role: 'user', text: query },
    { role: 'model', text: fullSummary }
  ];

  return {
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    topic: originalTopic,
    summary: fullSummary,
    images,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
    type: outputType,
    history: newHistory
  };
}
