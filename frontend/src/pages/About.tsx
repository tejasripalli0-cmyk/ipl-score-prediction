import type { ReactNode } from "react";
import { Card, PageHeader } from "../components/ui";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (<section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20"><h2 id={`${id}-h`} className="section-title mb-2">{title}</h2><Card><div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div></Card></section>);
}
const List = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1 pl-5">{items.map((i) => <li key={i}>{i}</li>)}</ul>;

const TOC = [["objective", "Objective"], ["data", "Dataset"], ["processing", "Data processing"], ["models", "Models"], ["backend", "Backend"], ["frontend", "Frontend"], ["stack", "Technology"], ["limits", "Limitations"], ["future", "Future work"]];

export default function About() {
  return (
    <div>
      <PageHeader title="About the Project" subtitle="How IPL Insight is built, what it uses, and where its limits are." />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block"><ul className="sticky top-6 space-y-1 text-sm">{TOC.map(([id, l]) => (<li key={id}><a className="block rounded px-2 py-1 text-slate-600 hover:bg-white hover:text-navy" href={`#${id}`}>{l}</a></li>))}</ul></nav>
        <div className="space-y-6">
          <Section id="objective" title="Project objective"><p>IPL Insight combines machine-learning predictions with historical analytics in one place. It estimates the final score of an innings, the chasing team's chance of winning, and lets people explore teams, players, venues and seasons.</p></Section>
          <Section id="data" title="Dataset"><p>The historical analytics use ball-by-ball IPL data from <b>Cricsheet</b> (cricsheet.org), covering seasons from 2007/08 to 2025. Every row is one delivery. The models were trained on this data with a chronological split, holding out 2025 as the test season.</p></Section>
          <Section id="processing" title="Data processing"><List items={[
            "Historical franchise names are mapped to one name per franchise (for example Delhi Daredevils to Delhi Capitals, Kings XI Punjab to Punjab Kings, Royal Challengers Bangalore to Royal Challengers Bengaluru).",
            "Different spellings of the same ground are grouped for analytics. The models themselves were trained on the original spellings, so prediction keeps that mapping.",
            "Exact duplicate delivery rows are removed. Match results come from one row per innings, so deliveries are never double counted.",
            "Only innings 1 and 2 are analysed; super overs are ignored.",
            "A match counts as a win or loss only when the dataset names a winner. Ties without a winner and no-result matches are not losses, and win percentage is wins ÷ (wins + losses).",
            "Rain-affected (DLS) matches count towards results but are excluded from scoring averages and records.",
            "Lowest score only considers completed innings (all out or all overs faced).",
            "Balls faced and bowled count legal deliveries only. Batting average and bowler wickets need dismissal columns; when the dataset lacks them the app says so instead of estimating."]} /></Section>
          <Section id="models" title="Machine-learning models"><List items={[
            "First innings: Random Forest Regressor (2025 test MAE 19.65, RMSE 26.77, R² 0.414).",
            "Second innings: Linear Regression (MAE 14.72, RMSE 19.23, R² 0.636).",
            "Win probability: Random Forest Classifier for the chasing team (accuracy 0.811, ROC-AUC 0.860).",
            "Each file stores the trained model, its fitted preprocessing pipeline and the feature list. The API loads them once at start-up and never retrains or alters them."]} />
            <p>The selected models are scikit-learn models. TensorFlow neural networks were explored but not selected because the traditional models scored better on the test season.</p></Section>
          <Section id="backend" title="Backend architecture"><p>A FastAPI service organised into modules: <code>models</code> (loads and validates the pickles), <code>schemas</code> (Pydantic request/response types), <code>routes</code> (HTTP endpoints), <code>services</code> (prediction logic and pandas analytics) and <code>utils</code> (team and venue normalisation). Requests are validated twice: by Pydantic, then by cricket-aware checks (for example rejecting a target that has already been reached). Interactive API docs are served at <code>/docs</code>.</p></Section>
          <Section id="frontend" title="Frontend architecture"><p>A React + TypeScript single-page app built with Vite. Pages are routed with React Router, data is fetched through a typed Axios client, charts use Recharts and styling uses Tailwind CSS with a small shared design system (cards, selects, stat tiles, chart frames). A shared match configuration (teams, venue, innings type) carries between the home page and the predictors.</p></Section>
          <Section id="stack" title="Technologies"><List items={["Frontend: React, Vite, TypeScript, Tailwind CSS, Recharts, Lucide React, React Router, Axios", "Backend: Python, FastAPI, Uvicorn, Pydantic, Pandas, NumPy", "Machine learning: scikit-learn 1.6.1, Joblib"]} /></Section>
          <Section id="limits" title="Limitations"><List items={[
            "Predictions are statistical estimates from past matches. They do not know about injuries, form, pitch, dew, toss decisions or who is batting.",
            "First-innings accuracy is modest (R² 0.414), especially early in the innings. The range shown is an indication, not a guaranteed interval.",
            "The saved models treat spelling variants of a venue as different venues, which can shift predictions; the app lets you choose the spelling.",
            "The win-probability model was trained on second-innings situations only and does not apply to the first innings.",
            "Team badges are initials on franchise colours unless you add official logos locally.",
            "Player statistics are limited by the columns in the dataset (see the notes shown on the player page)."]} /></Section>
          <Section id="future" title="Possible future work"><List items={[
            "Retrain with a single canonical venue name and add pitch/toss/weather features.",
            "Add calibrated prediction intervals (for example conformal prediction).",
            "Add SHAP explanations computed from the saved models.",
            "Add live-match input, player-level features and playoff-stage analysis."]} /></Section>
        </div>
      </div>
    </div>
  );
}
