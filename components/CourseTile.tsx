import Link from "next/link";

export type CourseTileCourse = {
  id: string;
  code: string;
  name: string;
  semester?: number | null;
};

const PALETTE = [
  "linear-gradient(135deg, rgba(9,50,120,.22), rgba(106,169,255,.14))",
  "linear-gradient(135deg, rgba(106,169,255,.20), rgba(141,214,255,.12))",
  "linear-gradient(135deg, rgba(245,158,11,.18), rgba(106,169,255,.10))",
  "linear-gradient(135deg, rgba(124,58,237,.18), rgba(141,214,255,.12))",
];

function emojiFor(code: string) {
  const c = (code || "").toUpperCase();

  // Most common medical subjects
  if (c.includes("PHAR")) return "💊";
  if (c.includes("MIC")) return "🔬";
  if (c.includes("PAR")) return "🦠";
  if (c.includes("PATH")) return "🧪";
  if (c.includes("BIO")) return "🧬";
  if (c.includes("ANAT")) return "🫀";
  if (c.includes("PHYS")) return "🧠";

  return "📘";
}

export default function CourseTile({ course, index }: { course: CourseTileCourse; index: number }) {
  const bg = PALETTE[index % PALETTE.length];
  const emoji = emojiFor(course.code);

  return (
    <div className="courseTile" style={{ background: bg }}>
      <Link href={`/courses/${course.id}`} className="courseTile__body">
        <div className="courseTile__icon courseTile__icon--emoji" aria-hidden>
          {emoji}
        </div>
        <div className="courseTile__meta">
          <div className="courseTile__code">
            {course.code}
            {course.semester ? (
              <span className="pill" style={{ marginInlineStart: 8 }}>
                ترم {course.semester}
              </span>
            ) : null}
          </div>
          <div className="courseTile__name">{course.name}</div>
        </div>
      </Link>

      <div className="courseTile__actions">
        <Link className="btn btn--ghost" href={`/courses/${course.id}`}>
          المحاضرات
        </Link>
        <Link className="btn" href={`/mcq?course=${course.id}`}>
          MCQ
        </Link>
      </div>
    </div>
  );
}
