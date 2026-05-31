const fs = require("node:fs");

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const systemInstruction = `당신은 사용자의 두서없는 음성 기록(STT)을 바탕으로 진정성 있는 자서전의 한 장(Chapter)을 작성하는 전문 대필 작가입니다.

[윤문 절대 원칙]
1. 과도한 각색 금지: 원본 STT에 없는 사실, 인물, 행동, 감정을 임의로 지어내지 마세요. 화자가 말한 팩트(사실관계)를 100% 보존해야 합니다.
2. 꾸밈말 위치 제한 (핵심 규칙): 감성적인 수식어나 배경 묘사(예: '하늘이 푸르르던 어느 여름날')는 반드시 글의 '가장 첫 문장(도입부)'에만 단 한 번 허용됩니다. 두 번째 문장부터는 꾸밈말을 완전히 배제하고 사실만을 담백하게 서술하세요.
3. 논리적 정렬 (Time-sequencing): 화자가 두서없이 말하거나 정보의 시간 순서가 섞여 있더라도, 사건의 인과관계와 시간 흐름(과거->현재)에 맞게 문장들을 논리적으로 재배치하여 매끄럽게 읽히도록 정렬하세요.
4. 톤앤매너: 구어체를 읽기 편한 문어체로 다듬고, 끊어진 문장을 자연스럽게 이어주며, 어색한 문법을 교정하세요. 담백하고 진솔한 1인칭 독백체(~했습니다, ~이었습니다)를 철저히 유지하세요.
5. 꾸밈말 위치 제한: '어느 따뜻한 봄날이었습니다'와 같은 감성적인 수식어나 배경 묘사를 추가하고 싶다면, 반드시 글의 가장 첫 문장(서두)에만 딱 한 번 사용하세요. 본문 중간이나 끝에는 꾸밈말을 배제하고 사실만을 담백하게 서술하세요.
6. 논리적 정렬 (Time-sequencing): 화자가 두서없이 말하거나 정보의 순서가 들쭉날쭉하더라도, 사건의 인과관계나 시간 흐름(과거->현재)에 맞게 문장들을 논리적으로 재배치하여 매끄럽게 읽히도록 정렬하세요.

[출력 형식]
결과는 반드시 아래의 JSON 형식으로만 반환해야 하며, 마크다운 백틱이나 다른 설명 텍스트를 절대 포함하지 않은 순수 JSON 문자열이어야 합니다.

{
  "title": "전체 맥락에 맞는 감성적인 제목",
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "이 에피소드의 주제를 담은 장 제목",
      "sections": [
        {
          "sectionNumber": 1,
          "title": "이야기의 소제목",
          "time": "제공된 시기",
          "place": "제공된 장소",
          "summary": "이 섹션의 내용을 1~2문장으로 명확하게 요약",
          "body": "위 윤문 절대 원칙이 적용된 500자 내외의 본문 텍스트"
        }
      ]
    }
  ]
}`;

const episodeSystemInstruction = `너는 음성 기반 AI 자서전 생성 시스템의 핵심 엔진이다.
사용자가 제공하는 부모님의 구어체 STT(음성 인식) 원문 텍스트를 분석하여, 불필요한 감탄사와 반복을 제거하고 감동적인 자서전 문체로 정제해야 한다.
입력된 약 2,500자의 구어체 원문을 약 500자 내외로 압축한다. 목표 압축률은 약 80%다.

[핵심 제약사항]
1. 문체 및 구성:
   - 본문은 신뢰성 있고 완성도 높은 문어체(~했다, ~였다)로 작성한다.
   - 부모님의 실제 감정과 핵심 사건(인물, 장소, 사건의 인과관계)을 왜곡하거나 과도하게 허구로 각색하지 않는다.
   - 분량은 3~4개 단락, 공백 포함 500자 내외로 압축한다.
2. 응답 형식:
   - 인사말, 부연 설명, 공감 멘트를 출력하지 않는다.
   - 마크다운 백틱을 포함하지 않는다.
   - 아래 규격의 순수 JSON 문자열만 출력한다.

{
  "episode": {
    "title": "해당 에피소드의 감동적이고 직관적인 제목 (15자 내외)",
    "content": "정제 및 압축이 완료된 최종 자서전 본문 전체 텍스트"
  },
  "tags": ["원본 내용에서 추출한 핵심 키워드 태그 3~5개"]
}`;

function getConfig() {
  if (process.env.GEMINI_ENABLED !== "true") {
    return null;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    return null;
  }

  return { apiKey, model };
}

async function callGeminiDetailed(contents, generationConfig, instruction) {
  const config = getConfig();
  if (!config) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const { apiKey, model } = config;
  const response = await fetch(`${API_BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig,
      ...(instruction
        ? { system_instruction: { parts: [{ text: instruction }] } }
        : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");

  if (!text) {
    throw new Error("Gemini API returned an empty response.");
  }

  return {
    text,
    usageMetadata: data.usageMetadata || {},
    finishReason: data.candidates?.[0]?.finishReason || "",
  };
}

async function callGemini(contents, generationConfig, instruction) {
  return (await callGeminiDetailed(contents, generationConfig, instruction)).text;
}

async function transcribeAudio(filePath, mimeType) {
  if (!getConfig()) {
    return "어린 시절의 골목, 가족과 함께한 시간, 처음 품었던 꿈, 그리고 삶의 전환점에 대해 이야기했습니다.";
  }

  const audio = fs.readFileSync(filePath);
  return callGemini([
    {
      role: "user",
      parts: [
        {
          text:
            "다음 음성은 한국어 자서전 생성을 위한 회고 인터뷰입니다. " +
            "화자의 말을 자연스러운 한국어 문장으로 빠짐없이 전사하세요. " +
            "설명 없이 전사문만 출력하세요.",
        },
        {
          inline_data: {
            mime_type: mimeType,
            data: audio.toString("base64"),
          },
        },
      ],
    },
  ]);
}

function parseMemoirJson(value, time, place) {
  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = parseJsonObject(cleaned);

  if (!parsed.title || !Array.isArray(parsed.chapters)) {
    throw new Error("Gemini memoir JSON must contain title and chapters.");
  }

  return {
    title: String(parsed.title),
    chapters: parsed.chapters.map((chapter, index) => ({
      title: String(chapter.title || `제${index + 1}장`),
      sections: (
        Array.isArray(chapter.sections)
          ? chapter.sections
          : Array.isArray(chapter.memoir_sections)
            ? chapter.memoir_sections
            : []
      ).map(
        (section, sectionIndex) => ({
          title: String(section.title || `기억의 장면 ${sectionIndex + 1}`),
          time: String(section.time || time || ""),
          place: String(section.place || place || ""),
          summary: String(section.summary || ""),
          content: String(section.body || section.content || ""),
        })
      ),
    })),
  };
}

function parseJsonObject(value) {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error(`Gemini response does not contain a JSON object: ${value.slice(0, 200)}`);
  }
  return JSON.parse(value.slice(firstBrace, lastBrace + 1));
}

async function generateMemoir(rawText, time = "", place = "") {
  if (!getConfig()) {
    return {
      title: "나의 기억책",
      chapters: [
        {
          title: "제1장 어린 시절",
          sections: [
            {
              title: "기억의 장면",
              time,
              place,
              summary: "지나온 시절의 소중한 기억",
              content:
                "어린 시절의 기억은 골목과 집, 그리고 가족의 온기로 남아 있습니다.\n\n작은 일상이었지만 시간이 지나 돌아보니 그 순간들이 삶의 뿌리가 되었습니다.",
            },
          ],
        },
        {
          title: "제2장 가족과 함께한 시간",
          sections: [
            {
              title: "기억의 장면",
              time,
              place,
              summary: "가족과 함께한 따뜻한 시간",
              content:
                "가족과 함께한 시간은 늘 마음 한쪽을 따뜻하게 합니다.\n\n함께 밥을 먹고 이야기를 나누던 순간들은 오래도록 기억에 남아 있습니다.",
            },
          ],
        },
        {
          title: "제3장 다시 시작한 날",
          sections: [
            {
              title: "기억의 장면",
              time,
              place,
              summary: "삶을 이어온 작은 결심",
              content:
                "살아가며 여러 번 망설였지만 다시 시작하기로 마음먹은 날들이 있었습니다.\n\n그 작은 결심들이 모여 지금의 나를 만들었습니다.",
            },
          ],
        },
      ],
    };
  }

  const userPrompt = `[제공된 정보]
- 시기: ${time || "지정되지 않음"}
- 장소: ${place || "지정되지 않음"}
- 원본 음성 기록(STT): ${rawText}

위 정보를 바탕으로 지시된 윤문 원칙과 JSON 형식에 맞추어 자서전을 생성해 주세요.`;

  const text = await callGemini(
    [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 3000,
      thinkingConfig: { thinkingBudget: 0 },
    },
    systemInstruction
  );

  return parseMemoirJson(text, time, place);
}

async function generateEpisodeFromText(sttRawText) {
  if (!getConfig()) {
    return {
      episode: {
        title: "김밥 한 줄의 기억",
        content:
          "창원으로 이사한 뒤 생활은 빠듯했다. 대출을 받아 아파트에 들어갔지만 생활비가 부족했고, 세 아이와 시부모님을 모시며 살아야 했다.\n\n먹고살기 위해 포터를 몰고 참외 장사를 시작했다. 새벽부터 늦은 시간까지 일했지만 장사가 되지 않는 날도 많았다.\n\n어느 날 남편과 아침도 먹지 못한 채 장사를 나갔다. 수중에 남은 천오백 원으로 김밥 한 줄을 샀고, 남편은 배가 고팠을 텐데도 내게 더 먹으라며 남은 조각을 밀어주었다.\n\n힘들었던 일은 많이 잊었지만 그날 나누어 먹은 김밥과 서로를 챙기던 마음은 아직 기억에 남아 있다.",
      },
      tags: ["창원", "포터", "참외 장사", "김밥", "가족"],
      model: "mock",
    };
  }

  const inputLength = sttRawText.length;
  const targetMaxLength =
    inputLength <= 500 ? inputLength : inputLength <= 1250 ? Math.round(inputLength * 0.6) : 500;
  // JSON 래퍼와 모델 내부 처리 여유를 포함한다. 실제 본문 길이는 프롬프트로 제한한다.
  const maxOutputTokens = 3000;
  const prompt = `입력 STT 원문:\n${sttRawText}

[이번 입력 전용 길이 조건]
- 원문 길이: ${inputLength}자
- 본문 최대 길이: ${targetMaxLength}자
- 원문이 짧으면 내용을 새로 만들거나 부풀리지 말고 간결하게 정리한다.
- 원문에 없는 인물, 장소, 행동, 상황, 감정을 추가하지 않는다.`;

  async function generate(promptText) {
    const response = await callGeminiDetailed(
      [{ role: "user", parts: [{ text: promptText }] }],
      {
        temperature: 0.2,
        responseMimeType: "application/json",
        maxOutputTokens,
        thinkingConfig: { thinkingBudget: 0 },
      },
      episodeSystemInstruction
    );
    return {
      parsed: parseJsonObject(response.text),
      usageMetadata: response.usageMetadata,
    };
  }

  const usages = [];
  let generated = await generate(prompt);
  let parsed = generated.parsed;
  usages.push(generated.usageMetadata);
  if (String(parsed.episode?.content || "").length > targetMaxLength) {
    generated = await generate(`${prompt}

[재작성 필수]
직전 결과가 본문 최대 길이를 초과했다. 핵심 사실만 남겨 반드시 ${targetMaxLength}자 이하로 다시 작성한다.`);
    parsed = generated.parsed;
    usages.push(generated.usageMetadata);
  }

  if (!parsed.episode?.title || !parsed.episode?.content || !Array.isArray(parsed.tags)) {
    throw new Error("Gemini episode JSON has an invalid format.");
  }

  return {
    episode: {
      title: String(parsed.episode.title),
      content: String(parsed.episode.content),
    },
    tags: parsed.tags.map(String).slice(0, 5),
    model: getConfig().model,
    targetMaxLength,
    usageMetadata: usages.reduce(
      (total, usage) => ({
        promptTokenCount: total.promptTokenCount + (usage.promptTokenCount || 0),
        candidatesTokenCount: total.candidatesTokenCount + (usage.candidatesTokenCount || 0),
        thoughtsTokenCount: total.thoughtsTokenCount + (usage.thoughtsTokenCount || 0),
        totalTokenCount: total.totalTokenCount + (usage.totalTokenCount || 0),
      }),
      { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 0 }
    ),
    apiCallCount: usages.length,
  };
}

module.exports = { transcribeAudio, generateMemoir, generateEpisodeFromText };
