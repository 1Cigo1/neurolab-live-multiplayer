
import React, { useEffect, useMemo, useState } from "react";
import { socket } from "./lib/socket";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Brain, Users, MessageCircle, Play, RotateCcw, Copy, GraduationCap, ShieldCheck, Activity } from "lucide-react";

const emptyState = { users: [], messages: [], predictions: [], accuracy: 0, params: { learningRate: .7, epochs: 100, hiddenCount: 4 }, net: { epoch: 0, loss: null, history: [] }, trainingLog: [] };

function Lobby({ onJoined }) {
  const [username, setUsername] = useState(localStorage.getItem("nl_name") || "");
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const join = (type) => {
    if (!username.trim()) return setError("Lütfen kullanıcı adını gir.");
    localStorage.setItem("nl_name", username.trim());
    socket.connect();
    const event = type === "create" ? "create-room" : "join-room";
    if (type === "join" && !roomId.trim()) return setError("Oda kodunu gir veya yeni oda oluştur.");
    socket.emit(event, { username: username.trim(), role, roomId }, (res) => {
      if (res?.ok) onJoined(res.state);
      else setError("Odaya girilemedi.");
    });
  };
  return <main className="lobby">
    <section className="hero-card">
      <div className="brand"><Brain/> NeuroLab Live</div>
      <h1>Gerçek Zamanlı Çok Oyunculu Yapay Sinir Ağı Eğitim Laboratuvarı</h1>
      <p>Öğrenciler aynı odaya katılır, XOR problemi üzerinde çalışan modeli birlikte eğitir, sohbet eder ve öğrenme sürecini canlı izler.</p>
      <div className="login-card">
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Kullanıcı adın" />
        <input value={roomId} onChange={e=>setRoomId(e.target.value.toUpperCase())} placeholder="Oda kodu: AI-ABCD" />
        <div className="role-row">
          <button className={role==='student'?'active':''} onClick={()=>setRole('student')}>Öğrenci</button>
          <button className={role==='teacher'?'active':''} onClick={()=>setRole('teacher')}>Öğretmen</button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="actions"><button onClick={()=>join('create')}>Yeni Oda Oluştur</button><button className="secondary" onClick={()=>join('join')}>Odaya Katıl</button></div>
      </div>
    </section>
  </main>;
}
function NetworkVisualizer({ net }) {
  const hidden = net?.hiddenCount || 4;
  const nodes = Array.from({ length: hidden }, (_, i) => 36 + i * (160 / Math.max(1, hidden - 1)));
  return <div className="panel big"><h2><Brain/> Neural Network Animasyonu</h2>
    <svg viewBox="0 0 520 250" className="network-svg">
      {[70,170].map((y, i)=>nodes.map((hy,j)=><line key={`a${i}-${j}`} x1="90" y1={y} x2="260" y2={hy} className="wire wire-blue"/>))}
      {nodes.map((hy,j)=><line key={`b${j}`} x1="280" y1={hy} x2="430" y2="120" className="wire wire-purple"/>)}
      {[70,170].map((y,i)=><g key={i}><circle cx="80" cy={y} r="24" className="node input"/><text x="70" y={y+5}>x{i+1}</text></g>)}
      {nodes.map((y,i)=><g key={i}><circle cx="270" cy={y} r="21" className="node hidden"><animate attributeName="r" values="19;23;19" dur="1.8s" repeatCount="indefinite"/></circle><text x="260" y={y+5}>h{i+1}</text></g>)}
      <circle cx="440" cy="120" r="27" className="node output"/><text x="434" y="126">y</text>
      <text x="35" y="235" className="svg-label">Giriş katmanı</text><text x="220" y="235" className="svg-label">Gizli katman</text><text x="400" y="235" className="svg-label">Çıkış</text>
    </svg>
  </div>;
}
function TrainingPanel({ state }) {
  const p = state.params;
  const role = state.users.find(u=>u.id===socket.id)?.role;
  const canTrain = role === "teacher";
  const update = (patch) => socket.emit("update-params", patch);
  return <div className="panel"><h2><Activity/> Eğitim Paneli</h2>
    <label>Öğrenme oranı <b>{p.learningRate}</b><input type="range" min="0.05" max="1.5" step="0.05" value={p.learningRate} onChange={e=>update({ learningRate: Number(e.target.value) })}/></label>
    <label>Epoch <b>{p.epochs}</b><input type="range" min="10" max="2000" step="10" value={p.epochs} onChange={e=>update({ epochs: Number(e.target.value) })}/></label>
    <label>Gizli nöron <b>{p.hiddenCount}</b><input type="range" min="2" max="8" step="1" value={p.hiddenCount} onChange={e=>update({ hiddenCount: Number(e.target.value) })}/></label>
    <div className="button-row"><button disabled={!canTrain} onClick={()=>socket.emit('train-model')}><Play/> Eğit</button><button disabled={!canTrain} className="secondary" onClick={()=>socket.emit('reset-model')}><RotateCcw/> Sıfırla</button></div>
    {!canTrain && <p className="hint"><ShieldCheck size={16}/> Öğretmen rolü aktif: modeli sadece öğretmen eğitebilir.</p>}
    <div className="metric"><span>Toplam Epoch</span><b>{state.net?.epoch || 0}</b></div>
    <div className="metric"><span>Loss</span><b>{state.net?.loss == null ? "-" : state.net.loss.toFixed(5)}</b></div>
    <div className="metric"><span>Başarı</span><b>%{Math.round((state.accuracy || 0)*100)}</b></div>
  </div>;
}
function PredictionTable({ predictions }) {
  return <div className="panel"><h2>Tahmin Tablosu</h2><div className="table">
    <div className="tr head"><span>x1</span><span>x2</span><span>Beklenen</span><span>Tahmin</span><span>Durum</span></div>
    {predictions.map((p,i)=>{const cls=p.pred>=.5?1:0; const ok=cls===p.y; return <div className="tr" key={i}><span>{p.x[0]}</span><span>{p.x[1]}</span><span>{p.y}</span><span>{p.pred.toFixed(3)}</span><span className={ok?'ok':'bad'}>{ok?'Doğru':'Yanlış'}</span></div>})}
  </div></div>;
}
function LossChart({ history }) { return <div className="panel"><h2>Loss Grafiği</h2><div className="chart"><ResponsiveContainer><LineChart data={history || []}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="epoch"/><YAxis/><Tooltip/><Line type="monotone" dataKey="loss" stroke="#7c3aed" strokeWidth={3} dot={false}/></LineChart></ResponsiveContainer></div></div>; }
function UsersPanel({ state }) { const copy=()=>navigator.clipboard?.writeText(state.roomId); return <div className="panel"><h2><Users/> Oda</h2><div className="room-code"><b>{state.roomId}</b><button onClick={copy}><Copy size={16}/> Kopyala</button></div>{state.users.map(u=><div className="user" key={u.id}><span>{u.username}</span><em>{u.role==='teacher'?'Öğretmen':'Öğrenci'}</em></div>)}</div>; }
function Chat({ messages }) { const [text,setText]=useState(""); const send=()=>{socket.emit('chat-message',{text}); setText("")}; return <div className="panel chat"><h2><MessageCircle/> Chat</h2><div className="messages">{messages.map(m=><div className={m.system?'msg system':'msg'} key={m.id}><b>{m.username}</b><span>{m.text}</span><small>{m.time}</small></div>)}</div><div className="chat-input"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Mesaj yaz..."/><button onClick={send}>Gönder</button></div></div>; }
function Quiz() { const qs=[{q:'Epoch nedir?',a:'Veri setinin modele bir kez tamamen gösterilmesidir.'},{q:'Loss neyi gösterir?',a:'Model tahminlerinin gerçek değerlere uzaklığını gösterir.'},{q:'XOR neden önemlidir?',a:'Doğrusal ayrılamayan basit bir problem olduğu için gizli katman ihtiyacını gösterir.'}]; const [open,setOpen]=useState(null); return <div className="panel"><h2><GraduationCap/> Mini Quiz</h2>{qs.map((x,i)=><div className="quiz" onClick={()=>setOpen(open===i?null:i)} key={x.q}><b>{x.q}</b>{open===i&&<p>{x.a}</p>}</div>)}</div>; }
function TeachingCards() { const cards=[['Epoch nedir?','Modelin tüm veri setini kaç kez gördüğünü ifade eder.'],['Loss nedir?','Tahmin ile gerçek sonuç arasındaki hata miktarıdır.'],['Öğrenme oranı nedir?','Ağırlıkların her adımda ne kadar değişeceğini belirler.'],['Gizli katman neden kullanılır?','Karmaşık ve doğrusal olmayan ilişkileri öğrenmek için kullanılır.'],['XOR problemi neden önemlidir?','Basit görünmesine rağmen tek doğrusal çizgiyle ayrılamaz; sinir ağlarının gücünü gösterir.']]; return <div className="cards">{cards.map(c=><div className="teach" key={c[0]}><b>{c[0]}</b><p>{c[1]}</p></div>)}</div>; }
function TrainingLog({ log }) { return <div className="panel"><h2>Eğitim Geçmişi</h2><div className="log">{(log||[]).slice().reverse().map(x=><div key={x.id}>{x.reset ? `${x.time} - ${x.username} modeli sıfırladı.` : `${x.time} - ${x.username}: epoch ${x.epoch}, loss ${Number(x.loss).toFixed(5)}, başarı %${Math.round(x.accuracy*100)}`}</div>)}</div></div>; }

export default function App(){
  const [joined,setJoined]=useState(false); const [state,setState]=useState(emptyState);
  useEffect(()=>{ const handler=(s)=>setState(s); socket.on('room-state', handler); return()=>socket.off('room-state', handler); },[]);
  const history = useMemo(()=>state.net?.history || [], [state.net]);
  if(!joined) return <Lobby onJoined={(s)=>{setState(s); setJoined(true)}}/>;
  return <div className="app"><header><div><h1>NeuroLab Live</h1><p>Socket.IO tabanlı çok oyunculu yapay sinir ağı eğitim simülatörü</p></div><div className="status">Canlı Oda: <b>{state.roomId}</b></div></header>
    <div className="grid"><aside><TrainingPanel state={state}/><UsersPanel state={state}/></aside><main><NetworkVisualizer net={state.net}/><div className="two"><LossChart history={history}/><PredictionTable predictions={state.predictions}/></div><TeachingCards/><div className="two"><Quiz/><TrainingLog log={state.trainingLog}/></div></main><aside><Chat messages={state.messages}/></aside></div>
  </div>
}
