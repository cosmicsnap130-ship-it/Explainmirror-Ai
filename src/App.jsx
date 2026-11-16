import {useEffect, useState} from "react";

const KEY = "explainmirror.history.v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = h => { try { localStorage.setItem(KEY, JSON.stringify(h)); } catch {} };

function Section({title, tone, items}) {
  if (!items?.length) return null;
  return <div className={"card tone-" + tone}><h3>{title}</h3><ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul></div>;
}

export default function App() {
  const [view, setView] = useState("home"); // home | dash | result
  const [history, setHistory] = useState(load);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({topic: "", question: "", explanation: "", confidence: 50});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(null);
  const [disagree, setDisagree] = useState("");

  useEffect(() => { fetch("/api/status").then(r => r.json()).then(setStatus).catch(() => setStatus({configured: false})); }, []);
  useEffect(() => save(history), [history]);

  async function call(body) {
    const r = await fetch("/api/analyze", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something went wrong.");
    return j;
  }
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const fb = await call(form);
      const entry = {id: Date.now(), date: new Date().toISOString(), ...form, feedback: fb, challenges: []};
      setHistory(h => [entry, ...h]); setCurrent(entry); setView("result");
    } catch (err) { setError(err.message); }
    setBusy(false);
  }
  async function challenge() {
    if (disagree.trim().length < 10) return;
    setError(""); setBusy(true);
    try {
      const fb = await call({...current, challenge: {reply: disagree, previous: current.feedback}});
      const upd = {...current, feedback: fb, challenges: [...current.challenges, {said: disagree, reply: fb.challengeReply}]};
      setCurrent(upd); setHistory(h => h.map(x => x.id === upd.id ? upd : x)); setDisagree("");
    } catch (err) { setError(err.message); }
    setBusy(false);
  }
  const newAttempt = (prefill = {}) => { setForm({topic: "", question: "", explanation: "", confidence: 50, ...prefill}); setError(""); setView("dash"); };
  const open = h => { setCurrent(h); setError(""); setView("result"); };
  const aiOff = status && !status.configured;

  return (<>
    <header className="nav"><button className="logo" onClick={() => setView("home")}><span className="mark"/>ExplainMirror</button>
      <nav><button onClick={() => newAttempt()}>Practise</button></nav></header>
    {aiOff && <div className="banner">AI is not connected on this server, so analysis is switched off. Nothing here is simulated.</div>}
    <main>
      {view === "home" && <Home start={() => newAttempt()}/>}
      {view === "dash" && <Dash {...{form, setForm, submit, busy, error, history, open, aiOff, newAttempt}}/>}
      {view === "result" && current && <Result {...{current, disagree, setDisagree, challenge, busy, error, newAttempt, aiOff}}/>}
    </main>
  </>);
}

function Home({start}) {
  return (<>
    <section className="hero">
      <div>
        <h1>Understand how students think, not just what they answer.</h1>
        <p className="lead">You can copy a right answer and still not understand it. ExplainMirror asks you to explain a topic first, then shows you where your thinking is strong and where it wobbles.</p>
        <button className="cta" onClick={start}>Explain a topic</button>
      </div>
      <div className="mirror" aria-hidden="true">
        <div className="pane you"><b>You wrote</b><p>"Plants eat sunlight to make food."</p></div>
        <div className="pane ai"><b>The mirror shows</b><p>Is sunlight the food, or the energy? What does the plant actually take in?</p></div>
      </div>
    </section>
    <section className="steps">
      {[["Write first", "Explain the topic in your own words. No help until you try."], ["Rate your confidence", "Say how sure you feel, from 0 to 100%."], ["See the gap", "Get gaps, weak spots and two questions to think about. You can argue back."]].map(([t, d]) =>
        <div key={t}><h3>{t}</h3><p>{d}</p></div>)}
    </section>
  </>);
}

function Dash({form, setForm, submit, busy, error, history, open, aiOff, newAttempt}) {
  const set = k => e => setForm({...form, [k]: e.target.value});
  const ready = form.topic.trim() && form.explanation.trim().length >= 40 && !aiOff;
  return (<div className="grid">
    <form className="panel" onSubmit={submit}>
      <h2>Explain it in your own words</h2>
      <label>Topic<input value={form.topic} onChange={set("topic")} maxLength={120} placeholder="e.g. Photosynthesis"/></label>
      <label>Question (optional)<input value={form.question} onChange={set("question")} maxLength={400} placeholder="e.g. Why do plants need light?"/></label>
      <label>Your explanation <small>{form.explanation.trim().length} characters, 40 minimum</small>
        <textarea rows={7} value={form.explanation} onChange={set("explanation")} placeholder="Write what you think, even if you are not sure. Do not look anything up."/></label>
      <label>How confident are you? <b className="pct">{form.confidence}%</b>
        <input type="range" min="0" max="100" value={form.confidence} onChange={e => setForm({...form, confidence: +e.target.value})}/></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="cta" disabled={!ready || busy}>{busy ? "Reading your explanation…" : "Check my thinking"}</button>
    </form>
    <Progress history={history} open={open}/>
  </div>);
}

function Progress({history, open}) {
  const items = history.slice(0, 8).reverse();
  const avg = k => history.length ? Math.round(history.reduce((s, h) => s + (k === "c" ? h.confidence : h.feedback.score), 0) / history.length) : 0;
  return (<aside className="panel">
    <h2>Your progress</h2>
    {!history.length ? <p className="muted">No attempts yet. Your first explanation will appear here.</p> : <>
      <div className="stats"><div><b>{history.length}</b>attempts</div><div><b>{avg("c")}%</b>avg confidence</div><div><b>{avg("s")}%</b>avg understanding</div></div>
      <div className="chart" role="img" aria-label="Confidence compared with assessed understanding for recent attempts">
        {items.map(h => <div className="col" key={h.id} title={h.topic}><i style={{height: h.confidence + "%"}} className="c"/><i style={{height: h.feedback.score + "%"}} className="u"/></div>)}
      </div>
      <p className="legend"><span className="c"/>Confidence <span className="u"/>Assessed understanding</p>
      <p className="muted small">Understanding scores are AI estimates, not grades.</p>
      <h3>History</h3>
      <ul className="hist">{history.map(h => <li key={h.id}><button onClick={() => open(h)}><b>{h.topic}</b><span>{new Date(h.date).toLocaleDateString()} · {h.confidence}% sure · {h.feedback.level}</span></button></li>)}</ul>
    </>}
  </aside>);
}

function Result({current: c, disagree, setDisagree, challenge, busy, error, newAttempt, aiOff}) {
  const f = c.feedback; const gap = c.confidence - f.score;
  const calib = Math.abs(gap) <= 15 ? "Your confidence matches the estimate." : gap > 0 ? "You felt more sure than the estimate suggests." : "You understand more than you felt you did.";
  return (<div className="result">
    <h2>{c.topic}</h2>
    <div className="card summary">
      <div className="score"><b>{f.score}%</b><span>{f.level}</span></div>
      <div><p>{f.assessment}</p>
        <p className="note"><b>How sure is this assessment?</b> {f.certainty === "high" ? "Fairly sure." : f.certainty === "medium" ? "Moderately sure." : "Not very sure."} {f.uncertaintyNote}</p>
        <p className="note">You said {c.confidence}%. {calib}</p></div>
    </div>
    <div className="two"><Section title="Possible gaps in understanding" tone="gap" items={f.gaps}/><Section title="Reasoning weak spots" tone="weak" items={f.weaknesses}/></div>
    <Section title="Ways to improve" tone="tip" items={f.suggestions}/>
    <div className="two">
      <div className="card q"><h3>Think about this</h3><p>{f.thoughtQuestion}</p></div>
      <div className="card q"><h3>Try this next</h3><p>{f.followUp}</p></div>
    </div>
    <div className="card"><h3>Do you disagree?</h3>
      <p className="muted">The AI can be wrong. Tell it why, and it will look again.</p>
      {c.challenges.map((x, i) => <div className="chat" key={i}><p className="you">You: {x.said}</p><p>{x.reply || "I looked again and updated the feedback above."}</p></div>)}
      <textarea rows={3} value={disagree} onChange={e => setDisagree(e.target.value)} placeholder="I think my explanation already covers this because…"/>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="ghost" onClick={challenge} disabled={busy || aiOff || disagree.trim().length < 10}>{busy ? "Thinking…" : "Challenge this feedback"}</button>
    </div>
    <div className="actions"><button className="cta" onClick={() => newAttempt({topic: c.topic, question: c.question})}>Try this topic again</button><button className="ghost" onClick={() => newAttempt()}>New topic</button></div>
  </div>);
}
