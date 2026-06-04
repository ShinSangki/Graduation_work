// 앱 내에서 사용할 샘플 자서전 데이터와 관련된 타입 및 화면 변환 로직을 정의합니다.
export type BiographyBook = {
  id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  createdAt: string;
  recordedAt?: string;
  audioUrl?: string;
  rawText?: string;
  chapters: BiographyChapter[];
};

export type BiographyChapter = {
  chapterNumber: number;
  title: string;
  sections: BiographySection[];
};

export type BiographySection = {
  sectionNumber: number;
  title: string;
  episodeId?: string;
  recordingId?: number;
  audioUrl?: string;
  rawText?: string;
  time?: string;
  place?: string;
  summary?: string;
  pages: string[];
};

export type ReaderPage =
  | { type: "cover" }
  | { type: "toc" }
  | {
      type: "body";
      chapterNumber: number;
      chapterTitle: string;
      sectionNumber: number;
      sectionTitle: string;
      body: string;
      time?: string;
      place?: string;
      summary?: string;
    };

const TIME_ORDER: Record<string, number> = {
  "어린 시절": 10,
  "학창 시절": 20,
  "청춘 시절": 30,
  "가족과 함께한 시간": 40,
  "최근의 기억": 50,
};

function getChapterTimeOrder(chapter: BiographyChapter) {
  const time = chapter.sections.find((section) => section.time)?.time;
  if (time) return TIME_ORDER[time] ?? 999;
  if (chapter.title.includes("어린")) return 10;
  if (chapter.title.includes("학교")) return 20;
  if (chapter.title.includes("청춘")) return 30;
  if (chapter.title.includes("부모") || chapter.title.includes("가족")) return 40;
  if (chapter.title.includes("지금")) return 50;
  return 45;
}

/**
 * 녹음 결과를 기존 기억책의 목차에 합치고 시기순으로 다시 정렬한다.
 * 각 녹음 결과는 독립적인 장으로 유지한다.
 */
export function mergeMemoirBooks(current: BiographyBook, added: BiographyBook): BiographyBook {
  const chapters = [...current.chapters, ...added.chapters]
    .sort((left, right) => getChapterTimeOrder(left) - getChapterTimeOrder(right))
    .map((chapter, chapterIndex) => ({
      ...chapter,
      chapterNumber: chapterIndex + 1,
      sections: chapter.sections.map((section, sectionIndex) => ({
        ...section,
        sectionNumber: sectionIndex + 1,
      })),
    }));

  return {
    ...current,
    title: current.title,
    recordedAt: added.recordedAt ?? current.recordedAt,
    audioUrl: added.audioUrl ?? current.audioUrl,
    rawText: added.rawText ?? current.rawText,
    chapters,
  };
}

export const sampleBiography: BiographyBook = {
  id: "sample-memory-book",
  title: "나의 기억책",
  subtitle: "어린 시절부터 지금까지의 이야기",
  createdAt: "2026-05-29",
  rawText: `음... 어디서부터 말해야 하나. 어릴 때는 우리 집이 크지는 않았어. 그래도 식구들이 한 방에 모여 살았고, 저녁이면 다 같이 밥을 먹었지. 골목에 나가면 친구들이 늘 있었어. 구슬치기도 하고 딱지도 치고, 비가 오면 처마 밑에서 종이배를 접어서 웅덩이에 띄웠던 기억이 나. 해가 지면 어머니가 골목 끝에서 이름을 부르셨고, 그 소리를 들으면 집으로 뛰어가곤 했어.

학교도 걸어서 다녔어. 책가방이 무거웠지만 친구들이랑 같이 걸으면 힘든 줄 몰랐지. 교실에서는 분필 냄새가 났고 쉬는 시간이 되면 다들 복도로 뛰어나갔어. 그때는 하루하루가 별일 아닌 것 같았는데, 지금 생각하면 그런 평범한 날들이 참 소중했어.

젊었을 때는 집을 떠나 일도 시작했지. 처음에는 모든 게 서툴렀어. 실수도 하고, 사람들한테 혼도 나고, 집에 돌아오는 길에 마음이 무거운 날도 많았어. 그래도 내가 맡은 일은 끝까지 해야 한다고 생각했어. 가족이 있으니까 쉽게 포기할 수 없었지.

부모가 되고 나서는 부모님 마음을 조금 알겠더라. 자식이 아프면 대신 아파 주고 싶고, 힘들어하면 어떻게든 도와주고 싶었어. 사랑한다는 말을 자주 하지는 못했지만 밥을 챙기고 기다리고 걱정하는 것으로 마음을 전했던 것 같아.

이제 와서 돌아보면 삶은 거창한 일보다 작은 순간들로 채워져 있었어. 같이 밥을 먹던 저녁, 말없이 걷던 길, 가족을 기다리던 시간이 오래 남아. 가족들에게는 서로 마음을 너무 늦게 알아차리지 말라고 말해 주고 싶어. 가끔은 함께 앉아서 지난 이야기를 나누면 좋겠어.`,
  chapters: [
    {
      chapterNumber: 1,
      title: "어린 시절의 기억",
      sections: [
        {
          sectionNumber: 1,
          title: "골목에서 보낸 오후",
          pages: [
            "그 시절 골목은 내게 세상에서 가장 넓은 놀이터였습니다.\n\n친구들과 구슬치기, 딱지치기를 하며 해가 지는 줄도 몰랐습니다.\n\n해가 지면 어머니가 부르시는 목소리가 골목 끝까지 들려오곤 했습니다.",
            "비가 오는 날이면 처마 밑에 모여 빗소리를 들었습니다.\n\n작은 웅덩이에 종이배를 띄우고, 그것이 멀리 가는 모습을 보며 큰 여행을 떠난 듯한 기분을 느꼈습니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "작은 집의 온기",
          pages: [
            "우리 집은 크지 않았지만 늘 사람의 온기가 있었습니다.\n\n방 한쪽에는 이불이 차곡차곡 쌓여 있었고, 부엌에서는 밥 짓는 냄새가 하루를 열어 주었습니다.",
            "겨울밤이면 가족들이 한 방에 모여 앉았습니다.\n\n창문 틈으로 찬바람이 들어와도 서로 가까이 앉아 있으면 이상하게 춥지 않았습니다.",
          ],
        },
      ],
    },
    {
      chapterNumber: 2,
      title: "가족과 함께한 시간",
      sections: [
        {
          sectionNumber: 1,
          title: "저녁 밥상의 기억",
          pages: [
            "가족이 모두 모이는 저녁 시간은 하루 중 가장 따뜻한 시간이었습니다.\n\n소박한 반찬이 놓인 밥상 앞에서 우리는 그날 있었던 일을 하나씩 나누었습니다.",
            "아버지는 말수가 적었지만 늘 먼저 밥을 덜어 주셨고, 어머니는 작은 이야기에도 크게 웃어 주셨습니다.\n\n그 웃음이 오래도록 내 마음의 등불처럼 남아 있습니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "부모님의 뒷모습",
          pages: [
            "어릴 때는 부모님의 뒷모습을 자주 보았습니다.\n\n아버지는 이른 아침 집을 나서셨고, 어머니는 늦은 밤까지 집안일을 멈추지 않으셨습니다.",
            "그때는 그것이 당연한 일인 줄 알았습니다.\n\n세월이 지나고 나서야 그 뒷모습 안에 얼마나 많은 책임과 사랑이 담겨 있었는지 알게 되었습니다.",
          ],
        },
      ],
    },
    {
      chapterNumber: 3,
      title: "학교 가던 길",
      sections: [
        {
          sectionNumber: 1,
          title: "책가방을 메고 걷던 아침",
          pages: [
            "학교에 가는 길은 늘 같은 길이었지만 매일 조금씩 다르게 느껴졌습니다.\n\n봄에는 담장 너머 꽃이 피었고, 여름에는 이마에 땀이 맺혔습니다.",
            "책가방은 가볍지 않았지만 친구들과 함께 걸으면 힘든 줄 몰랐습니다.\n\n우리는 별것 아닌 이야기로 웃으며 학교까지의 긴 길을 짧게 만들었습니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "교실 안의 하루",
          pages: [
            "교실에는 분필 냄새와 나무 책상의 냄새가 섞여 있었습니다.\n\n선생님의 목소리가 칠판 앞에서 울리면, 우리는 조용히 공책을 펴고 글씨를 따라 적었습니다.",
            "쉬는 시간이 되면 교실은 금세 시끄러워졌습니다.\n\n누군가는 창가에 기대 밖을 보았고, 누군가는 복도로 뛰어나가 친구 이름을 불렀습니다.",
          ],
        },
      ],
    },
    {
      chapterNumber: 4,
      title: "청춘의 시간들",
      sections: [
        {
          sectionNumber: 1,
          title: "처음 품었던 꿈",
          pages: [
            "청춘의 나는 세상을 아주 넓고도 낯설게 느꼈습니다.\n\n하고 싶은 일은 많았지만 어디서부터 시작해야 할지 몰라 자주 망설였습니다.",
            "그래도 마음 한편에는 분명한 꿈이 있었습니다.\n\n언젠가 내 이름으로 무언가를 완성하고, 사랑하는 사람들에게 부끄럽지 않은 삶을 살고 싶었습니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "낯선 세상으로 나아가다",
          pages: [
            "처음 집을 떠나던 날의 공기는 아직도 기억납니다.\n\n설렘보다 두려움이 더 컸지만, 뒤돌아보지 않으려고 애써 발걸음을 앞으로 옮겼습니다.",
            "낯선 곳에서의 하루는 쉽지 않았습니다.\n\n그러나 모르는 길을 하나씩 익히고, 새로운 사람의 이름을 외우며 조금씩 내 자리를 만들어 갔습니다.",
          ],
        },
      ],
    },
    {
      chapterNumber: 5,
      title: "삶의 전환점",
      sections: [
        {
          sectionNumber: 1,
          title: "다시 시작한 날",
          pages: [
            "삶에는 조용히 방향이 바뀌는 순간이 있습니다.\n\n그날도 특별한 일은 없어 보였지만, 나는 더 이상 미루지 않기로 마음먹었습니다.",
            "작은 결심은 하루의 습관이 되었고, 습관은 시간이 지나 내 삶의 모양을 바꾸었습니다.\n\n돌아보면 가장 큰 변화는 언제나 아주 작은 시작에서 왔습니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "견뎌야 했던 시간",
          pages: [
            "살다 보면 아무에게도 쉽게 말하지 못하는 시간이 찾아옵니다.\n\n겉으로는 괜찮은 척했지만, 마음속으로는 여러 번 주저앉고 싶었습니다.",
            "그럴 때마다 나를 붙잡아 준 것은 거창한 희망이 아니었습니다.\n\n오늘 하루만 버티자는 생각, 그리고 나를 기다리는 가족의 얼굴이었습니다.",
          ],
        },
      ],
    },
    {
      chapterNumber: 6,
      title: "일하며 배운 것들",
      sections: [
        {
          sectionNumber: 1,
          title: "처음 맡은 일",
          pages: [
            "처음 일을 시작했을 때 나는 모든 것이 서툴렀습니다.\n\n작은 실수에도 마음이 무거웠고, 누군가의 한마디에 하루 종일 생각이 많아지곤 했습니다.",
            "하지만 일을 배운다는 것은 단지 기술을 익히는 일이 아니었습니다.\n\n사람을 대하는 법, 책임을 지는 법, 내 몫을 끝까지 해내는 법을 조금씩 배워 가는 시간이었습니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "땀으로 지나온 계절",
          pages: [
            "바쁜 날에는 시간이 어떻게 지나갔는지도 모를 만큼 몸을 움직였습니다.\n\n집으로 돌아오는 길에는 다리가 무거웠지만, 오늘도 하루를 해냈다는 마음이 있었습니다.",
            "그 시절의 땀은 쉽게 사라지지 않았습니다.\n\n지금 돌아보면 그 시간들이 내 삶을 단단하게 받쳐 준 기둥이 되었습니다.",
          ],
        },
      ],
    },
    {
      chapterNumber: 7,
      title: "부모가 되어 알게 된 마음",
      sections: [
        {
          sectionNumber: 1,
          title: "자식을 바라보는 마음",
          pages: [
            "부모가 되고 나서야 부모님의 마음을 조금 알게 되었습니다.\n\n자식이 아프면 대신 아프고 싶고, 자식이 힘들면 어떻게든 길을 찾아 주고 싶었습니다.",
            "예전에는 부모님의 걱정이 잔소리처럼 들릴 때도 있었습니다.\n\n하지만 이제는 그 말들이 모두 사랑을 표현하는 서툰 방식이었다는 것을 압니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "말하지 못했던 사랑",
          pages: [
            "가족에게 사랑한다는 말을 자주 하지는 못했습니다.\n\n마음은 있었지만 표현하는 일이 어색했고, 괜히 멋쩍어 다른 말로 둘러대곤 했습니다.",
            "그래도 밥을 챙기고, 기다리고, 걱정하고, 조용히 곁을 지키는 방식으로 마음을 전하려 했습니다.\n\n돌아보면 내 사랑은 늘 말보다 행동에 가까웠습니다.",
          ],
        },
      ],
    },
    {
      chapterNumber: 8,
      title: "지금 돌아보는 삶",
      sections: [
        {
          sectionNumber: 1,
          title: "평범한 날들의 의미",
          pages: [
            "젊을 때는 특별한 순간만 오래 남는다고 생각했습니다.\n\n하지만 나이가 들수록 마음에 남는 것은 오히려 평범한 날들의 표정이었습니다.",
            "같이 밥을 먹던 시간, 아무 말 없이 걷던 길, 누군가를 기다리던 저녁이 오래 기억에 남았습니다.\n\n삶은 큰 사건보다 그런 작은 순간들로 채워져 있었습니다.",
          ],
        },
        {
          sectionNumber: 2,
          title: "가족에게 남기고 싶은 말",
          pages: [
            "내가 가족에게 남기고 싶은 말은 거창하지 않습니다.\n\n서로의 마음을 너무 늦게 알아차리지 않았으면 합니다.",
            "살다 보면 바쁘고 힘든 날이 많겠지만, 가끔은 함께 앉아 지난 이야기를 나누었으면 좋겠습니다.\n\n기억은 말할 때 다시 살아나고, 그 말은 가족의 역사가 됩니다.",
          ],
        },
      ],
    },
  ],
};

export function buildReaderPages(book: BiographyBook): ReaderPage[] {
  const bodyPages = book.chapters.flatMap((chapter) =>
    chapter.sections.map((section) => ({
      type: "body" as const,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.title,
      sectionNumber: section.sectionNumber,
      sectionTitle: section.title,
      time: section.time,
      place: section.place,
      summary: section.summary,
      body: section.pages.join("\n\n"),
    }))
  );

  return [{ type: "cover" }, { type: "toc" }, ...bodyPages];
}

export function formatKoreanDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function getFirstBodyText(book: BiographyBook) {
  return book.chapters[0]?.sections[0]?.pages[0] ?? "";
}
