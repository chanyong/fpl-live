import type { Metadata } from "next";
import { isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { FEEDBACK_URL } from "@/lib/site";

const TITLE = "자주 묻는 질문 | FPL Live";
const DESCRIPTION =
  "FPL Live에서 미니리그 리그 ID 찾는 법, 잠정 점수·보너스 예상·순위 변동 읽는 법, 가격 변동 예측, 개인정보와 문제 해결에 대한 자주 묻는 질문을 모았습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: { type: "website", siteName: "FPL Live", locale: "ko_KR", title: TITLE, description: DESCRIPTION, url: "/faq", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] }
};

// 사이트의 다른 화면은 한국어·영어를 바꿔 볼 수 있지만 이 페이지는 한국어로만 쓴다.
// 정책이 정해지지 않은 답은 [정책 확인 필요] 로 남겨 둔다.
const Feedback = () => (
  <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">피드백 · 버그 제보</a>
);

type Item = { q: string; a: ReactNode };
const CATEGORIES: { id: string; title: string; items: Item[] }[] = [
  {
    id: "start",
    title: "시작하기",
    items: [
      { q: "FPL Live는 어떤 사이트인가요?", a: <p>판타지 프리미어리그(FPL) <b>미니리그</b>의 순위를 경기 중에 실시간으로 보여 주는 사이트입니다. 게임위크 잠정 점수, 순위 변동, 매니저별 스쿼드를 공식 FPL 데이터로 보여 줍니다.</p> },
      {
        q: "처음 왔는데 어떻게 시작하나요?",
        a: (
          <ol>
            <li>첫 화면 입력 칸에 <b>공개 클래식 리그 ID</b>(숫자)를 넣습니다.</li>
            <li><b>대시보드 열기</b>를 누르면 그 리그의 라이브 순위표가 나옵니다.</li>
            <li>리그 ID가 없다면 <b>가격 변동 예측 보기</b>부터 둘러보세요.</li>
          </ol>
        )
      },
      {
        q: "리그 ID는 어디서 찾나요?",
        a: <p>FPL 공식 홈페이지나 앱에서 내 리그를 열면 주소에 숫자가 있습니다(예: …/leagues/<b>915874</b>/standings). 그 숫자가 리그 ID입니다. 첫 화면의 안내 링크로 FPL 홈페이지와 앱을 바로 열 수 있습니다.</p>
      },
      { q: "회원가입이나 로그인이 필요한가요?", a: <p>아니요. FPL 계정 로그인 없이 공개 리그 ID만으로 볼 수 있습니다.</p> },
      { q: "공식 FPL 사이트인가요?", a: <p>아니요. FPL Live는 비공식 팬 서비스이며 Premier League 및 Fantasy Premier League와 제휴 관계가 없습니다. 데이터는 FPL이 공개한 자료를 씁니다.</p> }
    ]
  },
  {
    id: "features",
    title: "주요 기능 사용법",
    items: [
      { q: "‘잠정 집계’는 무슨 뜻인가요?", a: <p>경기 중인 점수를 그때그때 더한 값이라는 뜻입니다. 보너스 포인트와 자동 교체는 FPL이 게임위크를 확정한 뒤 바뀔 수 있어, 최종 점수와 다를 수 있습니다.</p> },
      { q: "순위표는 얼마나 자주 바뀌나요?", a: <p>대시보드를 열어 두면 30초마다 새로 불러옵니다. 바로 갱신하려면 <b>새로고침</b>을 누르세요.</p> },
      {
        q: "리그 화면의 탭은 무엇을 보여 주나요?",
        a: (
          <ul>
            <li><b>순위표</b>: 매니저별 GW 점수·누적 점수와 순위 변동</li>
            <li><b>선수</b>: 우리 리그에서 많이 가진 선수, 주장 선택, 포지션별 득점</li>
            <li><b>팀</b>·<b>경기 일정</b>: 팀별 다음 경기와 일정 난이도</li>
            <li><b>순위 추이</b>: 게임위크마다 순위가 어떻게 바뀌었는지</li>
          </ul>
        )
      },
      { q: "보너스 포인트 예상은 어떻게 계산하나요?", a: <p>경기 일정 카드의 <b>보너스 예상</b>은 FPL이 공개하는 실시간 BPS(보너스 포인트 시스템) 점수로 경기마다 1·2·3위에게 3·2·1점을 매긴 값입니다. 동점이면 같은 점수를 받습니다. FPL이 보너스를 확정하면 <b>보너스 확정</b>으로 바뀝니다.</p> },
      { q: "라이벌과 점수 차를 계속 보고 싶어요", a: <p>주간 순위 화면의 <b>내 라이벌과 점수 차</b>에서 나와 라이벌을 고르면 이번 GW 점수 차·잠정 총점 차·주장·나만 가진 선발 선수를 경기 중에도 계속 보여 줍니다. 선택은 저장하지 않아서 페이지를 새로 열면 다시 고릅니다.</p> },
      { q: "다른 매니저와 스쿼드를 비교할 수 있나요?", a: <p>네. 순위표의 <b>스쿼드 비교</b>를 누르고 매니저 2명을 고른 뒤 <b>비교하기</b>를 누르면 두 사람의 스쿼드를 나란히 볼 수 있습니다.</p> },
      { q: "남은 칩을 한눈에 보고 싶어요", a: <p><b>칩 사용 현황</b>에서 매니저별로 쓴 칩과 남은 칩을 볼 수 있습니다. 칩은 전·후반기에 각각 한 번씩 주어집니다.</p> },
      { q: "가격이 오를 선수를 미리 알 수 있나요?", a: <p><Link href="/price-changes">가격 변동 예측</Link>에서 이번 마감 전 가격이 오를 선수와 내릴 선수를 볼 수 있습니다. 리그 ID 없이 바로 쓸 수 있습니다. 예측이므로 실제 변동과 다를 수 있습니다.</p> },
      { q: "우리 리그 화면을 친구에게 보내고 싶어요", a: <p>대시보드의 <b>리그 공유</b>를 누르면 주소가 복사됩니다. 받은 사람도 로그인 없이 같은 화면을 볼 수 있습니다.</p> },
      { q: "영어로 볼 수 있나요?", a: <p>네. 화면 오른쪽 위 언어 버튼으로 한국어와 영어를 바꿀 수 있고, 고른 언어는 이 브라우저에 기억됩니다. 이 FAQ는 한국어로만 제공합니다.</p> }
    ]
  },
  {
    id: "account",
    title: "계정·로그인",
    items: [
      { q: "내 FPL 계정을 연결해야 하나요?", a: <p>아니요. FPL 아이디·비밀번호를 묻지 않으며 계정을 연결하지 않습니다. 이적·주장 변경 같은 팀 관리는 FPL 공식 사이트나 앱에서 하세요.</p> },
      { q: "비공개(초대 전용) 리그도 볼 수 있나요?", a: <p>공개 클래식 리그 ID를 넣어 보는 방식입니다. FPL이 공개하지 않는 리그 정보는 보여 줄 수 없습니다. 초대 전용 리그가 열리는지는 [확인 필요]입니다.</p> },
      { q: "자주 보는 리그를 저장할 수 있나요?", a: <p>한 번 연 리그는 첫 화면의 <b>최근 본 리그</b>에 최대 6개까지 남습니다. 이 목록은 지금 쓰는 브라우저에만 저장되고 서버로 보내지 않습니다. 다른 기기에서도 쓰려면 대시보드 주소(…/league/리그ID)를 즐겨찾기에 넣어 두세요.</p> }
    ]
  },
  {
    id: "billing",
    title: "결제·요금",
    items: [
      { q: "이용료가 있나요?", a: <p>없습니다. 모든 기능이 무료입니다.</p> },
      { q: "나중에 유료로 바뀌나요?", a: <p>[정책 확인 필요] 유료 기능이 생기면 이곳에 먼저 안내하겠습니다.</p> },
      { q: "FPL 상금이나 리그 참가비를 여기서 낼 수 있나요?", a: <p>아니요. FPL Live는 결제 기능이 없습니다. 이 사이트 이름으로 돈을 요구받았다면 응하지 마세요.</p> }
    ]
  },
  {
    id: "privacy",
    title: "개인정보·보안",
    items: [
      { q: "제 정보를 수집하나요?", a: <p>회원가입이 없어 이름·연락처를 받지 않습니다. 방문 통계를 위해 Google Analytics를 쓰고, ‘의견·질문’ 버튼으로 보낸 내용만 따로 저장합니다. 화면에 나오는 매니저 이름·팀 이름은 FPL이 공개한 리그 정보입니다. 자세한 내용은 <Link href="/privacy">개인정보처리방침</Link>을 보세요.</p> },
      { q: "방문 기록은 얼마나 보관하나요?", a: <p>Google Analytics 이용 통계는 Google 설정에 따라 최대 14개월, ‘의견·질문’으로 보낸 내용은 1년 뒤 자동 삭제됩니다. 최근 본 리그·언어 설정은 내 브라우저에만 있고 언제든 지울 수 있습니다. <Link href="/privacy">개인정보처리방침</Link> 참고.</p> },
      { q: "내 이름이 다른 사람에게 보이는 게 싫어요", a: <p>리그 순위의 이름은 FPL에 등록한 이름입니다. FPL 공식 사이트의 계정 설정에서 바꿀 수 있고, 바꾸면 이 사이트에도 반영됩니다.</p> }
    ]
  },
  {
    id: "trouble",
    title: "문제 해결",
    items: [
      { q: "‘리그 데이터를 불러오지 못했습니다’가 떠요", a: <ol><li>리그 ID 숫자가 맞는지 확인하세요.</li><li>게임위크 마감·집계 직후에는 FPL 서버가 잠시 응답하지 않을 수 있습니다. 몇 분 뒤 다시 시도하세요.</li><li>계속되면 <Feedback />에 리그 ID와 시각을 남겨 주세요.</li></ol> },
      { q: "점수가 FPL 공식 앱과 달라요", a: <p>경기 중에는 잠정 점수라 보너스 포인트와 자동 교체가 아직 반영되지 않았을 수 있습니다. 게임위크가 확정되면 공식 점수와 같아집니다.</p> },
      { q: "가격 변동 예측과 실제 결과가 달라요", a: <p>가격 변동은 FPL이 공개하지 않는 기준으로 결정되어 예측이 빗나갈 수 있습니다. 참고용으로만 보세요.</p> },
      { q: "버그를 발견했어요", a: <p><Feedback />(GitHub)에 어떤 화면에서 무엇을 했는지, 리그 ID와 함께 남겨 주세요.</p> }
    ]
  }
];

/** Plain text of an answer for the FAQPage structured data. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (node.type === Feedback) return "의견·질문 버튼";
    const inner = textOf(node.props.children);
    return node.type === "li" ? `${inner} ` : inner;
  }
  return "";
}

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CATEGORIES.flatMap((c) =>
    c.items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: textOf(it.a).replace(/\s+/g, " ").trim() }
    }))
  )
};

export default function FaqPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
      <Link href="/" className="text-body font-semibold text-[var(--muted)] hover:text-[var(--accent)]">← FPL Live</Link>
      <h1 className="mt-6 text-3xl font-semibold leading-tight md:text-4xl">자주 묻는 질문</h1>
            <nav aria-label="질문 분류" className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-meta font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">{c.title}</a>
        ))}
      </nav>
      {CATEGORIES.map((c) => (
        <section key={c.id} id={c.id} aria-labelledby={`${c.id}-t`} className="mt-10 scroll-mt-6">
          <h2 id={`${c.id}-t`} className="mb-3 text-lg font-semibold">{c.title}</h2>
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
            {c.items.map((it) => (
              <details key={it.q} className="group open:bg-[var(--accent-soft)]">
                <summary className="flex cursor-pointer list-none items-start gap-2 border-l-4 border-transparent px-5 py-4 font-semibold hover:bg-[var(--surface-strong)]/40 group-open:border-[var(--accent)] [&::-webkit-details-marker]:hidden">
                  <span className="font-bold text-[var(--accent)]">Q</span>
                  <span className="flex-1 break-keep">{it.q}</span>
                  <span aria-hidden className="text-[var(--muted)] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="space-y-2 break-keep px-5 pb-5 pl-10 text-body-lg leading-7 text-[var(--muted)] [&_a]:font-semibold [&_a]:text-[var(--accent)] [&_a]:underline [&_b]:text-[var(--text)] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">{it.a}</div>
              </details>
            ))}
          </div>
          <p className="mt-2 text-meta text-[var(--muted)] [&_a]:font-semibold [&_a]:underline">해결되지 않았다면 <Feedback />에 남겨 주세요.</p>
        </section>
      ))}
    </main>
  );
}
