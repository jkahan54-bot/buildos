import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{ autoRefreshToken:false, persistSession:false } });

export default async function ClientPortalView({ params }: { params: { id: string } }) {
  const [{ data: project }, { data: milestones }, { data: photos }, { data: incidents }] = await Promise.all([
    admin.from("projects").select("*").eq("id", params.id).single(),
    admin.from("milestones").select("*").eq("project_id", params.id).order("due_date"),
    admin.from("site_photos").select("*").eq("project_id", params.id).order("taken_at", { ascending:false }).limit(12),
    admin.from("safety_incidents").select("type,severity,status,created_at").eq("project_id", params.id).eq("status","Open"),
  ]);

  if (!project) notFound();

  const pct     = project.budget > 0 ? Math.round((project.spent ?? 0) / project.budget * 100) : 0;
  const fmtMoney = (n: number) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

  return (
    <div style={{ fontFamily:"Arial,sans-serif", background:"#f9fafb", minHeight:"100vh", padding:"0" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#f97316,#ea580c)", padding:"24px 32px", color:"#fff" }}>
        <div style={{ maxWidth:800, margin:"0 auto" }}>
          <div style={{ fontSize:12, opacity:0.8, marginBottom:4 }}>Brookstone Developers · Project Update</div>
          <h1 style={{ fontSize:24, fontWeight:900, margin:0 }}>{project.name}</h1>
          <div style={{ fontSize:13, opacity:0.9, marginTop:4 }}>{project.phase ?? "In Progress"} · Due {project.deadline ?? "TBD"}</div>
        </div>
      </div>

      <div style={{ maxWidth:800, margin:"0 auto", padding:"24px 32px" }}>
        {/* Progress */}
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:8 }}>Overall Completion</div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ flex:1, height:12, background:"#f3f4f6", borderRadius:6, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"#16a34a", borderRadius:6, width:`${project.progress??0}%`, transition:"width .5s" }} />
            </div>
            <span style={{ fontSize:22, fontWeight:900, color:"#16a34a" }}>{project.progress ?? 0}%</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:16 }}>
            {[
              { label:"Contract Value", value:fmtMoney(project.budget??0), color:"#2563eb" },
              { label:"Spent to Date",  value:fmtMoney(project.spent??0),  color:"#f97316" },
              { label:"Budget Remaining", value:fmtMoney((project.budget??0)-(project.spent??0)), color:"#16a34a" },
            ].map(s => (
              <div key={s.label} style={{ background:"#f9fafb", borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        {milestones && milestones.length > 0 && (
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Milestones</div>
            {milestones.map(m => (
              <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"1px solid #f3f4f6" }}>
                <div style={{ width:20, height:20, borderRadius:"50%", background:m.completed?"#16a34a":"#e5e7eb", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {m.completed && <span style={{ color:"#fff", fontSize:11, fontWeight:900 }}>✓</span>}
                </div>
                <div style={{ flex:1, fontSize:13, color:m.completed?"#9ca3af":"#374151", textDecoration:m.completed?"line-through":"none" }}>{m.title}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>{m.due_date ?? ""}</div>
              </div>
            ))}
          </div>
        )}

        {/* Photos */}
        {photos && photos.filter(p=>p.url).length > 0 && (
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Recent Site Photos</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {photos.filter(p=>p.url).slice(0,6).map(p => (
                <img key={p.id} src={p.url} alt={p.label??""} style={{ width:"100%", height:120, objectFit:"cover", borderRadius:8 }} />
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign:"center", fontSize:11, color:"#9ca3af", marginTop:24 }}>
          Powered by BuildOS · Brookstone Developers · {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
