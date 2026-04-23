import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG — reemplaza esta URL después del paso 1 ──────────────────────────
const SCRIPT_URL = "https://ieps-tracker.vercel.app/";
// Ejemplo: "https://script.google.com/macros/s/AKfycb.../exec"

// ─── Constants ───────────────────────────────────────────────────────────────
const USUARIOS = ["Christian", "Pasante 1", "Pasante 2", "Pasante 3"];

const DOCUMENTOS_CHECKLIST = [
  { id: "poder_notarial",      label: "Poder notarial del representante legal" },
  { id: "acta_constitutiva",   label: "Acta constitutiva" },
  { id: "cedula_fiscal",       label: "Cédula de identificación fiscal (RFC)" },
  { id: "declaraciones_ieps",  label: "Declaraciones de IEPS del período" },
  { id: "cfdi_traslado",       label: "CFDI de traslado del IEPS" },
  { id: "estados_cuenta",      label: "Estados de cuenta bancarios" },
  { id: "pedimentos",          label: "Pedimentos de importación/exportación" },
  { id: "solicitud_devolucion",label: "Solicitud de devolución ante el SAT" },
  { id: "resolucion_negativa", label: "Resolución negativa o ficta del SAT" },
  { id: "identificacion_rl",   label: "Identificación oficial del representante legal" },
];

const TIPOS_RECURSO = ["Nulidad", "Amparo", "Recurso de Revisión Fiscal"];
const ETAPAS = ["Integración", "Correo", "Post-Demanda", "Recursos/Sub-expediente"];

const EC = {
  "Integración":             { bg:"#FFF7ED", border:"#FB923C", text:"#9A3412", dot:"#F97316" },
  "Correo":                  { bg:"#EFF6FF", border:"#60A5FA", text:"#1E3A8A", dot:"#3B82F6" },
  "Post-Demanda":            { bg:"#F0FDF4", border:"#4ADE80", text:"#14532D", dot:"#22C55E" },
  "Recursos/Sub-expediente": { bg:"#FAF5FF", border:"#C084FC", text:"#581C87", dot:"#A855F7" },
};

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiCall(action, body = {}) {
  if (!SCRIPT_URL || SCRIPT_URL === "PEGA_AQUI_TU_URL_DEL_APPS_SCRIPT") {
    throw new Error("NO_URL");
  }
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function genId() { return "EXP-" + Date.now().toString(36).toUpperCase(); }
function today() { return new Date().toISOString().split("T")[0]; }
function diasPara(fecha) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha) - new Date()) / 86400000);
}
function urgColor(d) {
  if (d === null) return "#94A3B8";
  if (d < 0)  return "#EF4444";
  if (d <= 3) return "#F97316";
  if (d <= 7) return "#EAB308";
  return "#22C55E";
}

// ─── Micro components ─────────────────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      background:color.bg, border:`1px solid ${color.border}`, color:color.text,
    }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:color.dot }}/>
      {label}
    </span>
  );
}

function DeadlineBadge({ fecha }) {
  if (!fecha) return <span style={{ color:"#94A3B8", fontSize:12 }}>—</span>;
  const d = diasPara(fecha);
  const c = urgColor(d);
  const icon = d < 0 ? "⚠️" : d <= 3 ? "🔴" : d <= 7 ? "🟡" : "🟢";
  const label = d < 0 ? `Vencido ${Math.abs(d)}d` : d === 0 ? "Hoy" : `${d}d`;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:c }}>
      {icon} {label}
      <span style={{ fontWeight:400, color:"#94A3B8" }}>({fecha})</span>
    </span>
  );
}

function Modal({ title, onClose, children, width = 700 }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:"#fff", borderRadius:18, width:"100%", maxWidth:width,
        maxHeight:"92vh", overflowY:"auto",
        boxShadow:"0 32px 80px rgba(0,0,0,.25)",
      }}>
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"18px 24px", borderBottom:"1px solid #E2E8F0",
          position:"sticky", top:0, background:"#fff", zIndex:1,
          borderRadius:"18px 18px 0 0",
        }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:"#0F172A" }}>{title}</h2>
          <button onClick={onClose} style={{
            border:"none", background:"#F1F5F9", borderRadius:8, width:32, height:32,
            cursor:"pointer", fontSize:18, color:"#64748B",
          }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#374151", marginBottom:5, textTransform:"uppercase", letterSpacing:.4 }}>
        {label}{required && <span style={{ color:"#EF4444" }}> *</span>}
      </label>
      {children}
      {hint && <p style={{ margin:"3px 0 0", fontSize:11, color:"#94A3B8" }}>{hint}</p>}
    </div>
  );
}

const inp = {
  width:"100%", padding:"9px 12px", border:"1px solid #D1D5DB",
  borderRadius:8, fontSize:13, color:"#111827", background:"#fff",
  boxSizing:"border-box", outline:"none", fontFamily:"inherit",
};

// ─── Formulario ───────────────────────────────────────────────────────────────
function ExpedienteForm({ onSave, onClose, expedienteEdit }) {
  const isEdit = !!expedienteEdit;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(expedienteEdit || {
    id: genId(), contribuyente:"", rfc:"", representante:"", periodo:"",
    monto:"", responsable:USUARIOS[0], documentos:{},
    deadlinePresentacion:"", etapa:"Integración",
    correo:"", password:"",
    expedienteTribunal:"", fechaPresentacion:"",
    tribunal:"", tipoRecurso:"",
    siguienteActuacion:"", ultimoAcuerdo:"", resumenAcuerdo:"",
    tieneTermino:false, descripcionTermino:"",
    subExpedientes:[], creadoEn:today(),
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDoc = (k, v) => setForm(f => ({ ...f, documentos:{ ...f.documentos, [k]:v } }));
  const faltantes = DOCUMENTOS_CHECKLIST.filter(d => !form.documentos[d.id]);
  const todoOk = faltantes.length === 0;

  const copiarCorreoFaltantes = () => {
    const lista = faltantes.map(d => `  - ${d.label}`).join("\n");
    const txt = `Asunto: Documentación pendiente – Exp. ${form.id}\n\nEstimado/a ${form.representante || "[Representante]"},\n\nPara continuar con el trámite de devolución de IEPS correspondiente al período ${form.periodo || "[período]"} de ${form.contribuyente || "[Contribuyente]"}, nos faltan los siguientes documentos:\n\n${lista}\n\nLe pedimos hacerlos llegar antes del ${form.deadlinePresentacion || "[fecha límite]"}.\n\nQuedamos a sus órdenes.\nUnCommon Legal`;
    navigator.clipboard?.writeText(txt);
    alert("✅ Correo copiado al portapapeles");
  };

  const handleSave = async () => {
    if (!form.contribuyente || !form.rfc) return alert("Contribuyente y RFC son obligatorios.");
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = ["📋 Integración", "📧 Correo", "⚖️ Post-Demanda"];

  return (
    <>
      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:22, background:"#F8FAFC", borderRadius:10, padding:4 }}>
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setStep(i+1)} style={{
            flex:1, padding:"8px 4px", border:"none", borderRadius:7, cursor:"pointer",
            fontWeight:step===i+1?800:500, fontSize:12, fontFamily:"inherit",
            background:step===i+1?"#fff":"transparent",
            color:step===i+1?"#0F172A":"#64748B",
            boxShadow:step===i+1?"0 1px 4px rgba(0,0,0,.1)":"none",
            transition:"all .2s",
          }}>{t}</button>
        ))}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Contribuyente (Razón Social)" required>
              <input style={inp} value={form.contribuyente} onChange={e=>set("contribuyente",e.target.value)} placeholder="Empresa S.A. de C.V." />
            </Field>
            <Field label="RFC" required>
              <input style={inp} value={form.rfc} onChange={e=>set("rfc",e.target.value.toUpperCase())} placeholder="ABC010101XXX" />
            </Field>
            <Field label="Representante Legal">
              <input style={inp} value={form.representante} onChange={e=>set("representante",e.target.value)} />
            </Field>
            <Field label="Período de la devolución">
              <input style={inp} value={form.periodo} onChange={e=>set("periodo",e.target.value)} placeholder="Ene–Jun 2024" />
            </Field>
            <Field label="Monto solicitado ($MXN)">
              <input style={inp} type="number" value={form.monto} onChange={e=>set("monto",e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Responsable">
              <select style={{ ...inp, cursor:"pointer" }} value={form.responsable} onChange={e=>set("responsable",e.target.value)}>
                {USUARIOS.map(u=><option key={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Etapa actual">
            <select style={{ ...inp, cursor:"pointer" }} value={form.etapa} onChange={e=>set("etapa",e.target.value)}>
              {ETAPAS.map(e=><option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="Deadline de presentación de demanda">
            <input style={inp} type="date" value={form.deadlinePresentacion} onChange={e=>set("deadlinePresentacion",e.target.value)} />
          </Field>

          {/* Checklist */}
          <div style={{ background:"#F8FAFC", borderRadius:12, padding:16, marginTop:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:12, color:"#0F172A", textTransform:"uppercase", letterSpacing:.4 }}>Checklist de documentos</p>
              <span style={{
                fontSize:12, fontWeight:700, padding:"2px 10px", borderRadius:20,
                background:todoOk?"#DCFCE7":"#FEF2F2", color:todoOk?"#15803D":"#DC2626",
              }}>{DOCUMENTOS_CHECKLIST.length - faltantes.length}/{DOCUMENTOS_CHECKLIST.length}</span>
            </div>
            <div style={{ display:"grid", gap:7 }}>
              {DOCUMENTOS_CHECKLIST.map(doc => (
                <label key={doc.id} style={{
                  display:"flex", alignItems:"center", gap:10, cursor:"pointer",
                  padding:"8px 12px", borderRadius:8,
                  background:form.documentos[doc.id]?"#F0FDF4":"#fff",
                  border:`1px solid ${form.documentos[doc.id]?"#BBF7D0":"#E2E8F0"}`,
                  transition:"all .15s",
                }}>
                  <input type="checkbox" checked={!!form.documentos[doc.id]}
                    onChange={e=>setDoc(doc.id, e.target.checked)}
                    style={{ accentColor:"#16A34A", width:15, height:15 }} />
                  <span style={{ fontSize:12, color:form.documentos[doc.id]?"#15803D":"#374151" }}>{doc.label}</span>
                </label>
              ))}
            </div>
            {!todoOk && (
              <div style={{ marginTop:12, display:"flex", gap:8, alignItems:"stretch" }}>
                <div style={{
                  flex:1, background:"#FFF7F7", border:"1px solid #FCA5A5",
                  borderRadius:8, padding:"8px 12px", fontSize:12, color:"#991B1B",
                }}>
                  ⚠️ Faltan: {faltantes.map(d=>d.label).join(", ")}
                </div>
                <button onClick={copiarCorreoFaltantes} style={{
                  padding:"0 14px", background:"#1E40AF", color:"#fff", border:"none",
                  borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
                  fontFamily:"inherit",
                }}>📋 Copiar correo</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div>
          <div style={{
            background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10,
            padding:14, marginBottom:20, fontSize:13, color:"#1E40AF",
          }}>
            📌 Verifica primero si el contribuyente ya tiene correo registrado en otro expediente.
          </div>
          <Field label="Correo electrónico de presentación">
            <input style={inp} type="email" value={form.correo} onChange={e=>set("correo",e.target.value)} placeholder="contribuyente@empresa.com" />
          </Field>
          <Field label="Contraseña" hint="Se guarda únicamente en este sistema.">
            <input style={inp} type="text" value={form.password} onChange={e=>set("password",e.target.value)} />
          </Field>
          <div style={{
            background:form.correo?"#F0FDF4":"#F8FAFC",
            border:`1px solid ${form.correo?"#BBF7D0":"#E2E8F0"}`,
            borderRadius:10, padding:14, marginTop:4, fontSize:13,
            color:form.correo?"#15803D":"#94A3B8",
          }}>
            {form.correo ? `✅ Correo registrado: ${form.correo}` : "⬆️ Registra el correo arriba."}
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <Field label="Expediente del tribunal">
              <input style={inp} value={form.expedienteTribunal} onChange={e=>set("expedienteTribunal",e.target.value)} placeholder="123/2024" />
            </Field>
            <Field label="Fecha de presentación">
              <input style={inp} type="date" value={form.fechaPresentacion} onChange={e=>set("fechaPresentacion",e.target.value)} />
            </Field>
            <Field label="Tribunal / Sala">
              <input style={inp} value={form.tribunal} onChange={e=>set("tribunal",e.target.value)} placeholder="Primera Sala Regional Puebla" />
            </Field>
            <Field label="Tipo de recurso">
              <select style={{ ...inp, cursor:"pointer" }} value={form.tipoRecurso} onChange={e=>set("tipoRecurso",e.target.value)}>
                <option value="">— Seleccionar —</option>
                {TIPOS_RECURSO.map(t=><option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Próxima actuación procesal">
              <input style={inp} type="date" value={form.siguienteActuacion} onChange={e=>set("siguienteActuacion",e.target.value)} />
            </Field>
            <Field label="Fecha del último acuerdo">
              <input style={inp} type="date" value={form.ultimoAcuerdo} onChange={e=>set("ultimoAcuerdo",e.target.value)} />
            </Field>
          </div>
          <Field label="Resumen del acuerdo / sentencia">
            <textarea style={{ ...inp, height:80, resize:"vertical" }}
              value={form.resumenAcuerdo} onChange={e=>set("resumenAcuerdo",e.target.value)}
              placeholder="El tribunal requirió..." />
          </Field>
          <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:14 }}>
            <input type="checkbox" checked={form.tieneTermino} onChange={e=>set("tieneTermino",e.target.checked)}
              style={{ accentColor:"#7C3AED", width:15, height:15 }} />
            <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>El acuerdo otorga término (alegatos, requerimiento, etc.)</span>
          </label>
          {form.tieneTermino && (
            <Field label="Descripción del término / plazo">
              <input style={inp} value={form.descripcionTermino} onChange={e=>set("descripcionTermino",e.target.value)}
                placeholder="10 días para presentar alegatos, vence el..." />
            </Field>
          )}

          {/* Sub-expedientes */}
          <div style={{ marginTop:20, borderTop:"1px solid #E2E8F0", paddingTop:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:12, color:"#0F172A", textTransform:"uppercase", letterSpacing:.4 }}>
                Sub-expedientes
              </p>
              <button onClick={() => {
                const nuevo = { id:genId(), tipo:"Amparo", deadlinePresentacion:"",
                  expedienteTribunal:"", siguienteActuacion:"", resumen:"", creadoEn:today() };
                set("subExpedientes", [...(form.subExpedientes||[]), nuevo]);
              }} style={{
                padding:"6px 12px", background:"#7C3AED", color:"#fff",
                border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              }}>+ Sub-expediente</button>
            </div>
            {(form.subExpedientes||[]).length === 0 && (
              <p style={{ fontSize:12, color:"#94A3B8", textAlign:"center", padding:12 }}>
                Sin sub-expedientes. Añade uno para Amparo, Revisión Fiscal o Ejecución.
              </p>
            )}
            {(form.subExpedientes||[]).map((sub, i) => (
              <div key={sub.id} style={{
                background:"#FAF5FF", border:"1px solid #DDD6FE", borderRadius:10, padding:14, marginBottom:10,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#7C3AED" }}>#{i+1} — {sub.tipo} — {sub.id}</span>
                  <button onClick={() => set("subExpedientes", form.subExpedientes.filter((_,j)=>j!==i))}
                    style={{ border:"none", background:"none", cursor:"pointer", color:"#EF4444", fontSize:18 }}>×</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <Field label="Tipo">
                    <select style={{ ...inp, cursor:"pointer" }} value={sub.tipo}
                      onChange={e=>{ const a=[...form.subExpedientes]; a[i]={...a[i],tipo:e.target.value}; set("subExpedientes",a); }}>
                      <option>Amparo</option>
                      <option>Recurso de Revisión Fiscal</option>
                      <option>Ejecución de sentencia</option>
                    </select>
                  </Field>
                  <Field label="Deadline">
                    <input type="date" style={inp} value={sub.deadlinePresentacion}
                      onChange={e=>{ const a=[...form.subExpedientes]; a[i]={...a[i],deadlinePresentacion:e.target.value}; set("subExpedientes",a); }} />
                  </Field>
                  <Field label="Exp. tribunal">
                    <input style={inp} value={sub.expedienteTribunal}
                      onChange={e=>{ const a=[...form.subExpedientes]; a[i]={...a[i],expedienteTribunal:e.target.value}; set("subExpedientes",a); }} />
                  </Field>
                  <Field label="Siguiente actuación">
                    <input type="date" style={inp} value={sub.siguienteActuacion}
                      onChange={e=>{ const a=[...form.subExpedientes]; a[i]={...a[i],siguienteActuacion:e.target.value}; set("subExpedientes",a); }} />
                  </Field>
                </div>
                <Field label="Resumen">
                  <textarea style={{ ...inp, height:60, resize:"vertical" }} value={sub.resumen}
                    onChange={e=>{ const a=[...form.subExpedientes]; a[i]={...a[i],resumen:e.target.value}; set("subExpedientes",a); }} />
                </Field>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:24, paddingTop:20, borderTop:"1px solid #F1F5F9" }}>
        <div style={{ display:"flex", gap:8 }}>
          {step > 1 && <button onClick={()=>setStep(s=>s-1)} style={{ padding:"9px 18px", border:"1px solid #D1D5DB", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, color:"#374151", fontFamily:"inherit" }}>← Anterior</button>}
          {step < 3 && <button onClick={()=>setStep(s=>s+1)} style={{ padding:"9px 18px", border:"none", borderRadius:8, background:"#0F172A", cursor:"pointer", fontSize:13, fontWeight:700, color:"#fff", fontFamily:"inherit" }}>Siguiente →</button>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ padding:"9px 18px", border:"1px solid #D1D5DB", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:13, color:"#64748B", fontFamily:"inherit" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding:"9px 22px", border:"none", borderRadius:8,
            background:saving?"#94A3B8":"#16A34A", cursor:saving?"not-allowed":"pointer",
            fontSize:13, fontWeight:700, color:"#fff", fontFamily:"inherit",
          }}>{saving?"Guardando…":"💾 Guardar"}</button>
        </div>
      </div>
    </>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [error, setError]             = useState(null);
  const [modal, setModal]             = useState(null);
  const [selected, setSelected]       = useState(null);
  const [filtroEtapa, setFiltroEtapa] = useState("Todos");
  const [filtroResp, setFiltroResp]   = useState("Todos");
  const [busqueda, setBusqueda]       = useState("");
  const [detalle, setDetalle]         = useState(null);

  const noUrl = !SCRIPT_URL || SCRIPT_URL === "PEGA_AQUI_TU_URL_DEL_APPS_SCRIPT";

  const fetchAll = useCallback(async () => {
    if (noUrl) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const data = await apiCall("getAll");
      setExpedientes(data.expedientes || []);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }, [noUrl]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = useCallback(async (exp) => {
    setSyncing(true);
    await apiCall("save", { expediente: exp });
    await fetchAll();
    setSyncing(false);
  }, [fetchAll]);

  const handleDelete = useCallback(async (id) => {
    if (!confirm("¿Eliminar este expediente? Esta acción no se puede deshacer.")) return;
    setSyncing(true);
    await apiCall("delete", { id });
    await fetchAll();
    setSyncing(false);
    setDetalle(null);
  }, [fetchAll]);

  const filtered = expedientes.filter(e => {
    if (filtroEtapa !== "Todos" && e.etapa !== filtroEtapa) return false;
    if (filtroResp  !== "Todos" && e.responsable !== filtroResp) return false;
    if (busqueda && !`${e.contribuyente} ${e.rfc} ${e.id}`.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: expedientes.length,
    urgentes: expedientes.filter(e => { const d=diasPara(e.deadlinePresentacion||e.siguienteActuacion); return d!==null&&d>=0&&d<=7; }).length,
    vencidos: expedientes.filter(e => { const d=diasPara(e.deadlinePresentacion||e.siguienteActuacion); return d!==null&&d<0; }).length,
    porEtapa: ETAPAS.reduce((a,e)=>({...a,[e]:expedientes.filter(x=>x.etapa===e).length}),{}),
  };

  return (
    <div style={{ fontFamily:"'DM Sans','Sora',system-ui,sans-serif", background:"#F1F5F9", minHeight:"100vh", padding:20 }}>

      {/* Banner sin URL */}
      {noUrl && (
        <div style={{
          background:"#FFF7ED", border:"2px solid #FB923C", borderRadius:12,
          padding:"14px 20px", marginBottom:20, fontSize:13, color:"#9A3412",
        }}>
          <strong>⚙️ Configuración pendiente:</strong> Esta app aún no está conectada a Google Sheets.
          Sigue las instrucciones del <strong>Paso 1</strong> para activarla. Por ahora puedes explorar la interfaz.
        </div>
      )}

      {/* Header */}
      <div style={{
        background:"#0F172A", borderRadius:16, padding:"18px 24px",
        marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center",
        boxShadow:"0 4px 20px rgba(0,0,0,.15)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:24 }}>⚖️</span>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <h1 style={{ margin:0, fontSize:18, fontWeight:800, color:"#F8FAFC", letterSpacing:-.5 }}>UnCommon Legal</h1>
              <span style={{ fontSize:11, fontWeight:700, background:"#1E3A8A", color:"#93C5FD", padding:"2px 9px", borderRadius:20 }}>IEPS</span>
            </div>
            <p style={{ margin:0, fontSize:11, color:"#475569" }}>Sistema de seguimiento de devoluciones</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {syncing && <span style={{ fontSize:12, color:"#60A5FA" }}>⟳ Sincronizando…</span>}
          <button onClick={fetchAll} style={{
            padding:"8px 14px", background:"#1E293B", border:"1px solid #334155",
            borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600, color:"#94A3B8", fontFamily:"inherit",
          }}>↻ Actualizar</button>
          <button onClick={() => setModal("nuevo")} style={{
            display:"flex", alignItems:"center", gap:7,
            padding:"10px 18px", background:"#16A34A", border:"none",
            borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:700, color:"#fff", fontFamily:"inherit",
          }}>+ Nueva demanda</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:20 }}>
        {[
          { label:"Total",           val:stats.total,                          icon:"📁", c:"#0F172A" },
          { label:"Integración",     val:stats.porEtapa["Integración"]||0,     icon:"📋", c:"#F97316" },
          { label:"Correo",          val:stats.porEtapa["Correo"]||0,          icon:"📧", c:"#3B82F6" },
          { label:"Post-Demanda",    val:stats.porEtapa["Post-Demanda"]||0,    icon:"⚖️", c:"#22C55E" },
          { label:"Urgentes ≤7d",    val:stats.urgentes,                       icon:"🔥", c:"#EAB308" },
          { label:"Vencidos",        val:stats.vencidos,                       icon:"⚠️", c:"#EF4444" },
        ].map(s => (
          <div key={s.label} style={{ background:"#fff", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
            <p style={{ margin:"0 0 4px", fontSize:18 }}>{s.icon}</p>
            <p style={{ margin:0, fontSize:26, fontWeight:800, color:s.c, lineHeight:1 }}>{s.val}</p>
            <p style={{ margin:"4px 0 0", fontSize:11, color:"#94A3B8", fontWeight:600 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{
        background:"#fff", borderRadius:12, padding:"12px 16px",
        marginBottom:16, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center",
        boxShadow:"0 1px 3px rgba(0,0,0,.06)",
      }}>
        <input placeholder="🔍  Buscar…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
          style={{ ...inp, maxWidth:260, flex:1, minWidth:140 }} />
        <select style={{ ...inp, maxWidth:180, cursor:"pointer" }} value={filtroEtapa} onChange={e=>setFiltroEtapa(e.target.value)}>
          <option>Todos</option>
          {ETAPAS.map(e=><option key={e}>{e}</option>)}
        </select>
        <select style={{ ...inp, maxWidth:150, cursor:"pointer" }} value={filtroResp} onChange={e=>setFiltroResp(e.target.value)}>
          <option>Todos</option>
          {USUARIOS.map(u=><option key={u}>{u}</option>)}
        </select>
        <span style={{ fontSize:12, color:"#94A3B8", marginLeft:"auto" }}>{filtered.length} exp.</span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#991B1B" }}>
          ❌ Error al conectar con Google Sheets: {error}
        </div>
      )}

      {/* Tabla */}
      <div style={{ background:"#fff", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,.06)", overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:48, textAlign:"center", color:"#94A3B8" }}>Cargando expedientes…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:56, textAlign:"center" }}>
            <p style={{ fontSize:36, margin:"0 0 12px" }}>📂</p>
            <p style={{ color:"#94A3B8", fontSize:14, margin:0 }}>
              {expedientes.length === 0 ? "Sin expedientes aún. ¡Crea el primero!" : "Sin resultados."}
            </p>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Contribuyente","Período","Monto","Etapa","Deadline / Actuación","Responsable",""].map(h=>(
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.5, borderBottom:"1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp, i) => {
                const ec = EC[exp.etapa] || EC["Integración"];
                const docsOk = DOCUMENTOS_CHECKLIST.every(d=>exp.documentos?.[d.id]);
                const dl = exp.deadlinePresentacion || exp.siguienteActuacion;
                return (
                  <tr key={exp.id}
                    style={{ borderBottom:i<filtered.length-1?"1px solid #F1F5F9":"none", cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#FAFBFC"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}
                    onClick={() => setDetalle(exp)}
                  >
                    <td style={{ padding:"13px 16px" }}>
                      <p style={{ margin:0, fontWeight:700, fontSize:13, color:"#0F172A" }}>{exp.contribuyente}</p>
                      <p style={{ margin:0, fontSize:11, color:"#94A3B8" }}>
                        {exp.rfc} · {exp.id}
                        {!docsOk && <span style={{ color:"#F97316", marginLeft:6 }}>⚠️</span>}
                      </p>
                    </td>
                    <td style={{ padding:"13px 16px", fontSize:13, color:"#374151" }}>{exp.periodo||"—"}</td>
                    <td style={{ padding:"13px 16px", fontSize:13, fontWeight:700, color:"#0F172A" }}>
                      ${Number(exp.monto||0).toLocaleString("es-MX")}
                    </td>
                    <td style={{ padding:"13px 16px" }}><Badge label={exp.etapa} color={ec}/></td>
                    <td style={{ padding:"13px 16px" }}><DeadlineBadge fecha={dl}/></td>
                    <td style={{ padding:"13px 16px", fontSize:12, color:"#374151" }}>{exp.responsable}</td>
                    <td style={{ padding:"13px 16px" }}>
                      <button onClick={e=>{ e.stopPropagation(); setSelected(exp); setModal("editar"); }} style={{
                        padding:"5px 12px", border:"none", borderRadius:6,
                        background:"#0F172A", cursor:"pointer", fontSize:11, fontWeight:700, color:"#fff", fontFamily:"inherit",
                      }}>Editar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ textAlign:"center", fontSize:11, color:"#CBD5E1", marginTop:16 }}>
        UnCommon Legal · IEPS Tracker · Conectado a Google Sheets
      </p>

      {/* Modal nuevo */}
      {modal === "nuevo" && (
        <Modal title="Nueva demanda de devolución IEPS" onClose={()=>setModal(null)}>
          <ExpedienteForm onSave={handleSave} onClose={()=>setModal(null)} />
        </Modal>
      )}

      {/* Modal editar */}
      {modal === "editar" && selected && (
        <Modal title={`Editar: ${selected.contribuyente}`} onClose={()=>setModal(null)}>
          <ExpedienteForm onSave={handleSave} onClose={()=>setModal(null)} expedienteEdit={selected} />
        </Modal>
      )}

      {/* Modal detalle */}
      {detalle && (
        <Modal title="Expediente" onClose={()=>setDetalle(null)} width={640}>
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                  <Badge label={detalle.etapa} color={EC[detalle.etapa]||EC["Integración"]}/>
                  {detalle.tipoRecurso && <Badge label={detalle.tipoRecurso} color={{ bg:"#F0F9FF", border:"#7DD3FC", text:"#0C4A6E", dot:"#0EA5E9" }}/>}
                </div>
                <h3 style={{ margin:"0 0 4px", fontSize:20, fontWeight:800, color:"#0F172A" }}>{detalle.contribuyente}</h3>
                <p style={{ margin:0, fontSize:12, color:"#64748B" }}>RFC: {detalle.rfc} · {detalle.id} · {detalle.responsable}</p>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={{ margin:0, fontSize:24, fontWeight:800, color:"#0F172A" }}>${Number(detalle.monto||0).toLocaleString("es-MX")}</p>
                <p style={{ margin:0, fontSize:11, color:"#94A3B8" }}>Monto solicitado</p>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[["Período",detalle.periodo||"—"],["Representante",detalle.representante||"—"],["Correo",detalle.correo||"No registrado"],["Tribunal",detalle.tribunal||"—"]].map(([k,v])=>(
                <div key={k} style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 14px" }}>
                  <p style={{ margin:0, fontSize:10, color:"#94A3B8", fontWeight:700, textTransform:"uppercase" }}>{k}</p>
                  <p style={{ margin:"3px 0 0", fontSize:13, color:"#0F172A", fontWeight:600 }}>{v}</p>
                </div>
              ))}
            </div>

            <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:10, padding:14, marginBottom:16 }}>
              <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:12, color:"#92400E", textTransform:"uppercase" }}>🗓️ Fechas clave</p>
              {[["Deadline presentación",detalle.deadlinePresentacion],["Fecha presentación",detalle.fechaPresentacion],["Próxima actuación",detalle.siguienteActuacion],["Último acuerdo",detalle.ultimoAcuerdo]].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontSize:12, color:"#78716C" }}>{k}:</span>
                  <DeadlineBadge fecha={v}/>
                </div>
              ))}
            </div>

            {detalle.resumenAcuerdo && (
              <div style={{ background:"#F8FAFC", borderRadius:10, padding:14, marginBottom:16 }}>
                <p style={{ margin:"0 0 6px", fontWeight:700, fontSize:12, color:"#0F172A", textTransform:"uppercase" }}>📝 Último acuerdo</p>
                <p style={{ margin:0, fontSize:13, color:"#374151", lineHeight:1.6 }}>{detalle.resumenAcuerdo}</p>
                {detalle.tieneTermino && <div style={{ marginTop:8, padding:"6px 10px", background:"#FFF7ED", borderRadius:6, fontSize:12, color:"#92400E" }}>⏱️ <strong>Término:</strong> {detalle.descripcionTermino}</div>}
              </div>
            )}

            {(detalle.subExpedientes||[]).length > 0 && (
              <div style={{ marginBottom:16 }}>
                <p style={{ margin:"0 0 10px", fontWeight:700, fontSize:12, color:"#0F172A", textTransform:"uppercase" }}>🔗 Sub-expedientes</p>
                {detalle.subExpedientes.map(sub=>(
                  <div key={sub.id} style={{ background:"#FAF5FF", border:"1px solid #DDD6FE", borderRadius:10, padding:12, marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:"#7C3AED" }}>{sub.tipo}</span>
                      <span style={{ fontSize:11, color:"#94A3B8" }}>{sub.id}</span>
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:12, color:"#64748B" }}>
                      {sub.deadlinePresentacion && <span>Deadline: <DeadlineBadge fecha={sub.deadlinePresentacion}/></span>}
                      {sub.expedienteTribunal && <span>Exp: {sub.expedienteTribunal}</span>}
                      {sub.siguienteActuacion && <span>Prox: <DeadlineBadge fecha={sub.siguienteActuacion}/></span>}
                    </div>
                    {sub.resumen && <p style={{ margin:"6px 0 0", fontSize:12, color:"#374151" }}>{sub.resumen}</p>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", paddingTop:12, borderTop:"1px solid #F1F5F9" }}>
              <button onClick={()=>handleDelete(detalle.id)} style={{ padding:"8px 16px", border:"1px solid #FCA5A5", borderRadius:8, background:"#FFF5F5", cursor:"pointer", fontSize:12, fontWeight:600, color:"#DC2626", fontFamily:"inherit" }}>🗑️ Eliminar</button>
              <button onClick={()=>{ setSelected(detalle); setDetalle(null); setModal("editar"); }} style={{ padding:"8px 16px", border:"none", borderRadius:8, background:"#0F172A", cursor:"pointer", fontSize:12, fontWeight:700, color:"#fff", fontFamily:"inherit" }}>✏️ Editar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
