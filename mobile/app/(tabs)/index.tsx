import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { router } from "expo-router";

export default function MyDayScreen() {
  const [profile, setProfile]   = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks]       = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: p }, { data: pr }] = await Promise.all([
        supabase.from("profiles").select("*, organizations(name)").eq("id", user.id).single(),
        supabase.from("projects").select("id, name, status, progress, phase").limit(10),
      ]);
      setProfile(p);
      setProjects(pr ?? []);
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  const now  = new Date();
  const date = now.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const time = now.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>Good morning, {profile?.full_name?.split(" ")[0] ?? "there"} 👋</Text>
          <Text style={s.date}>{date}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Org */}
      {profile?.organizations?.name && (
        <View style={s.orgBadge}>
          <Text style={s.orgText}>🏗 {profile.organizations.name}</Text>
          <Text style={s.roleBadge}>{profile.role?.toUpperCase()}</Text>
        </View>
      )}

      {/* Quick stats */}
      <View style={s.statsRow}>
        {[
          { label:"Projects",  value: projects.length,                                          color:"#3B82F6" },
          { label:"Active",    value: projects.filter(p=>p.status==="active").length,            color:"#22C55E" },
          { label:"Time",      value: time,                                                       color:"#F46519" },
        ].map(s2 => (
          <View key={s2.label} style={s.statCard}>
            <Text style={[s.statValue, { color:s2.color }]}>{s2.value}</Text>
            <Text style={s.statLabel}>{s2.label}</Text>
          </View>
        ))}
      </View>

      {/* Projects */}
      <Text style={s.sectionTitle}>Your Projects</Text>
      {projects.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>🏗</Text>
          <Text style={s.emptyText}>No projects yet</Text>
          <Text style={s.emptyHint}>Create projects on the web portal</Text>
        </View>
      ) : (
        projects.map(p => {
          const col = p.status === "active" ? "#22C55E" : "#6B7280";
          return (
            <View key={p.id} style={s.projectCard}>
              <View style={s.projectRow}>
                <Text style={s.projectName}>{p.name}</Text>
                <View style={[s.badge, { backgroundColor: col + "22" }]}>
                  <Text style={[s.badgeText, { color: col }]}>{p.status}</Text>
                </View>
              </View>
              <Text style={s.projectPhase}>{p.phase ?? "No phase set"}</Text>
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width:`${p.progress ?? 0}%` as any, backgroundColor: col }]} />
              </View>
              <Text style={[s.progressPct, { color: col }]}>{p.progress ?? 0}% complete</Text>
            </View>
          );
        })
      )}

      {/* Quick actions */}
      <Text style={s.sectionTitle}>Quick Actions</Text>
      <View style={s.actionsGrid}>
        {[
          { icon:"⏱", label:"Clock In/Out",   screen:"/(tabs)/timelog" },
          { icon:"⚠️", label:"Report Incident", screen:"/(tabs)/safety"  },
          { icon:"📷", label:"Take Photo",      screen:"/(tabs)/photos"  },
          { icon:"✅", label:"Checklist",        screen:"/(tabs)/checklist" },
        ].map(a => (
          <TouchableOpacity key={a.label} style={s.actionCard} onPress={() => router.push(a.screen as any)}>
            <Text style={s.actionIcon}>{a.icon}</Text>
            <Text style={s.actionLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex:1, backgroundColor:"#08080A" },
  header:       { flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", padding:24, paddingTop:60 },
  greeting:     { fontSize:22, fontWeight:"800", color:"#F5F5F5" },
  date:         { fontSize:13, color:"#6B7280", marginTop:4 },
  logoutBtn:    { padding:8 },
  logoutText:   { color:"#EF4444", fontSize:13, fontWeight:"600" },
  orgBadge:     { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:10, padding:12, borderWidth:1, borderColor:"#222226", marginBottom:20 },
  orgText:      { color:"#F5F5F5", fontSize:13, fontWeight:"600" },
  roleBadge:    { color:"#F46519", fontSize:11, fontWeight:"700" },
  statsRow:     { flexDirection:"row", gap:10, marginHorizontal:24, marginBottom:24 },
  statCard:     { flex:1, backgroundColor:"#0E0E10", borderRadius:12, padding:14, borderWidth:1, borderColor:"#222226", alignItems:"center" },
  statValue:    { fontSize:20, fontWeight:"900", fontVariant:["tabular-nums"] },
  statLabel:    { fontSize:10, color:"#6B7280", marginTop:4, textTransform:"uppercase", letterSpacing:0.5 },
  sectionTitle: { fontSize:16, fontWeight:"800", color:"#F5F5F5", marginHorizontal:24, marginBottom:12 },
  emptyCard:    { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:16, padding:40, alignItems:"center", borderWidth:1, borderColor:"#222226", borderStyle:"dashed", marginBottom:24 },
  emptyIcon:    { fontSize:40, marginBottom:12 },
  emptyText:    { color:"#6B7280", fontSize:15, fontWeight:"600" },
  emptyHint:    { color:"#374151", fontSize:12, marginTop:4 },
  projectCard:  { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:14, padding:16, borderWidth:1, borderColor:"#222226", marginBottom:10 },
  projectRow:   { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:4 },
  projectName:  { fontSize:15, fontWeight:"700", color:"#F5F5F5", flex:1 },
  projectPhase: { fontSize:12, color:"#6B7280", marginBottom:10 },
  badge:        { borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  badgeText:    { fontSize:11, fontWeight:"700" },
  progressBar:  { height:6, backgroundColor:"#222226", borderRadius:3, overflow:"hidden" },
  progressFill: { height:"100%", borderRadius:3 },
  progressPct:  { fontSize:11, fontWeight:"700", marginTop:6 },
  actionsGrid:  { flexDirection:"row", flexWrap:"wrap", gap:12, marginHorizontal:24, marginBottom:24 },
  actionCard:   { width:"47%", backgroundColor:"#0E0E10", borderRadius:14, padding:20, alignItems:"center", borderWidth:1, borderColor:"#222226" },
  actionIcon:   { fontSize:30, marginBottom:10 },
  actionLabel:  { color:"#F5F5F5", fontSize:13, fontWeight:"700", textAlign:"center" },
});
