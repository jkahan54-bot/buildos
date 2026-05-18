import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from "react-native";
import { supabase } from "../../lib/supabase";

const SEV_COLOR: Record<string,string> = { Low:"#22C55E", Medium:"#F59E0B", High:"#F46519", Critical:"#EF4444" };

export default function SafetyScreen() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [projects, setProjects]   = useState<any[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm] = useState({ project_id:"", type:"Near Miss", severity:"Medium", description:"", location:"" });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [{ data: inc }, { data: proj }] = await Promise.all([
      supabase.from("safety_incidents").select("*, projects(name)").order("created_at", { ascending:false }).limit(30),
      supabase.from("projects").select("id, name"),
    ]);
    setIncidents(inc ?? []);
    setProjects(proj ?? []);
  };

  const submit = async () => {
    if (!form.project_id || !form.description) { Alert.alert("Fill in project and description"); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("org_id").eq("id", user!.id).single();
    await supabase.from("safety_incidents").insert({ ...form, org_id:prof?.org_id, reported_by:user!.id });
    setForm({ project_id:"", type:"Near Miss", severity:"Medium", description:"", location:"" });
    setShowForm(false); setLoading(false); await load();
    Alert.alert("✓ Incident reported");
  };

  const resolve = async (id: string) => {
    await supabase.from("safety_incidents").update({ status:"Closed" }).eq("id", id);
    await load();
  };

  const inp = StyleSheet.flatten([s.input]);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Safety</Text>
          <Text style={s.sub}>{incidents.filter(i=>i.status==="Open").length} open incidents</Text>
        </View>
        <TouchableOpacity style={s.reportBtn} onPress={() => setShowForm(!showForm)}>
          <Text style={s.reportBtnText}>{showForm ? "✕ Cancel" : "+ Report"}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        {[
          { label:"Open",     value: incidents.filter(i=>i.status==="Open").length,   color:"#EF4444" },
          { label:"High/Crit",value: incidents.filter(i=>["High","Critical"].includes(i.severity)).length, color:"#F46519" },
          { label:"Closed",   value: incidents.filter(i=>i.status==="Closed").length, color:"#22C55E" },
        ].map(s2 => (
          <View key={s2.label} style={s.statCard}>
            <Text style={[s.statVal, { color:s2.color }]}>{s2.value}</Text>
            <Text style={s.statLabel}>{s2.label}</Text>
          </View>
        ))}
      </View>

      {/* Report form */}
      {showForm && (
        <View style={s.form}>
          <Text style={s.formTitle}>Report Incident</Text>

          <Text style={s.label}>Project</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
            <View style={{ flexDirection:"row", gap:8 }}>
              {projects.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setForm(f=>({...f,project_id:p.id}))}
                  style={[s.chip, form.project_id===p.id && s.chipActive]}>
                  <Text style={[s.chipText, form.project_id===p.id && s.chipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={s.label}>Type</Text>
          <View style={s.row}>
            {["Near Miss","Injury","Hazard","Property Damage"].map(t => (
              <TouchableOpacity key={t} onPress={() => setForm(f=>({...f,type:t}))}
                style={[s.chip, form.type===t && s.chipActive]}>
                <Text style={[s.chipText, form.type===t && s.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Severity</Text>
          <View style={s.row}>
            {["Low","Medium","High","Critical"].map(sv => (
              <TouchableOpacity key={sv} onPress={() => setForm(f=>({...f,severity:sv}))}
                style={[s.chip, form.severity===sv && { borderColor:SEV_COLOR[sv], backgroundColor:SEV_COLOR[sv]+"22" }]}>
                <Text style={[s.chipText, form.severity===sv && { color:SEV_COLOR[sv] }]}>{sv}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Location</Text>
          <TextInput style={s.input} value={form.location} onChangeText={t => setForm(f=>({...f,location:t}))} placeholder="e.g. Level 5 - Grid C" placeholderTextColor="#555" />

          <Text style={s.label}>Description *</Text>
          <TextInput style={[s.input, { height:100, textAlignVertical:"top" }]} value={form.description} onChangeText={t => setForm(f=>({...f,description:t}))} placeholder="Describe what happened..." placeholderTextColor="#555" multiline />

          <TouchableOpacity style={[s.submitBtn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            <Text style={s.submitText}>{loading ? "Submitting…" : "Submit Report"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Incident list */}
      {incidents.map(inc => (
        <View key={inc.id} style={[s.incidentCard, { borderLeftColor:SEV_COLOR[inc.severity] ?? "#6B7280" }]}>
          <View style={s.incRow}>
            <View style={{ flex:1 }}>
              <View style={{ flexDirection:"row", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                <View style={[s.badge, { backgroundColor:SEV_COLOR[inc.severity]+"22" }]}>
                  <Text style={[s.badgeText, { color:SEV_COLOR[inc.severity] }]}>{inc.severity}</Text>
                </View>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{inc.type}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: inc.status==="Open"?"#F4651922":"#22222233" }]}>
                  <Text style={[s.badgeText, { color: inc.status==="Open"?"#F46519":"#6B7280" }]}>{inc.status}</Text>
                </View>
              </View>
              <Text style={s.incDesc}>{inc.description}</Text>
              <Text style={s.incMeta}>{inc.projects?.name ?? "—"} · {new Date(inc.incident_date).toLocaleDateString()}</Text>
            </View>
            {inc.status === "Open" && (
              <TouchableOpacity style={s.resolveBtn} onPress={() => resolve(inc.id)}>
                <Text style={s.resolveText}>Resolve</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex:1, backgroundColor:"#08080A" },
  header:       { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", padding:24, paddingTop:60 },
  title:        { fontSize:28, fontWeight:"900", color:"#F5F5F5" },
  sub:          { fontSize:13, color:"#6B7280", marginTop:4 },
  reportBtn:    { backgroundColor:"#EF4444", borderRadius:10, paddingHorizontal:16, paddingVertical:10 },
  reportBtnText:{ color:"#fff", fontWeight:"700", fontSize:13 },
  statsRow:     { flexDirection:"row", gap:10, marginHorizontal:24, marginBottom:20 },
  statCard:     { flex:1, backgroundColor:"#0E0E10", borderRadius:12, padding:14, borderWidth:1, borderColor:"#222226", alignItems:"center" },
  statVal:      { fontSize:22, fontWeight:"900" },
  statLabel:    { fontSize:10, color:"#6B7280", marginTop:4, textTransform:"uppercase" },
  form:         { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:16, padding:20, borderWidth:1, borderColor:"#F46519", marginBottom:20 },
  formTitle:    { fontSize:17, fontWeight:"800", color:"#F5F5F5", marginBottom:16 },
  label:        { fontSize:11, color:"#6B7280", textTransform:"uppercase", letterSpacing:1, marginBottom:8 },
  input:        { backgroundColor:"#08080A", borderWidth:1, borderColor:"#222226", borderRadius:10, padding:12, color:"#F5F5F5", fontSize:14, marginBottom:14 },
  row:          { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:14 },
  chip:         { paddingHorizontal:12, paddingVertical:7, borderRadius:8, borderWidth:1, borderColor:"#222226", backgroundColor:"#08080A" },
  chipActive:   { borderColor:"#F46519", backgroundColor:"#F4651922" },
  chipText:     { color:"#6B7280", fontSize:12, fontWeight:"600" },
  chipTextActive:{ color:"#F46519" },
  submitBtn:    { backgroundColor:"#EF4444", borderRadius:12, padding:14, alignItems:"center", marginTop:8 },
  btnDisabled:  { opacity:0.5 },
  submitText:   { color:"#fff", fontWeight:"800", fontSize:15 },
  incidentCard: { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:14, padding:16, borderWidth:1, borderColor:"#222226", borderLeftWidth:4, marginBottom:10 },
  incRow:       { flexDirection:"row", alignItems:"flex-start", gap:12 },
  incDesc:      { color:"#F5F5F5", fontSize:14, fontWeight:"600", marginBottom:4 },
  incMeta:      { color:"#6B7280", fontSize:12 },
  badge:        { paddingHorizontal:8, paddingVertical:4, borderRadius:6, backgroundColor:"#222226" },
  badgeText:    { fontSize:11, fontWeight:"700", color:"#9CA3AF" },
  resolveBtn:   { paddingHorizontal:12, paddingVertical:8, borderRadius:8, borderWidth:1, borderColor:"#22C55E" },
  resolveText:  { color:"#22C55E", fontSize:12, fontWeight:"700" },
});
