import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { supabase } from "../../lib/supabase";

export default function MessagesScreen() {
  const [channels, setChannels] = useState<any[]>([]);
  const [active, setActive]     = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput]       = useState("");
  const [userId, setUserId]     = useState<string | null>(null);
  const scrollRef               = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase.from("message_channels").select("*, projects(name)").order("created_at");
      setChannels(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    loadMessages(active.id);
    const sub = supabase.channel(`msgs-${active.id}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`channel_id=eq.${active.id}` }, payload => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated:true }), 100);
      }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [active]);

  const loadMessages = async (channelId: string) => {
    const { data } = await supabase.from("messages").select("*, profiles(full_name)").eq("channel_id", channelId).order("created_at").limit(100);
    setMessages(data ?? []);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated:false }), 100);
  };

  const send = async () => {
    if (!input.trim() || !active || !userId) return;
    const msg = input.trim(); setInput("");
    await supabase.from("messages").insert({ channel_id:active.id, sender_id:userId, content:msg });
  };

  if (!active) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom:40 }}>
        <View style={s.header}>
          <Text style={s.title}>Messages</Text>
          <Text style={s.sub}>{channels.length} channels</Text>
        </View>
        {channels.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyText}>No channels yet</Text>
            <Text style={s.emptyHint}>Channels are created automatically when projects are set up on the web portal</Text>
          </View>
        ) : channels.map(ch => (
          <TouchableOpacity key={ch.id} style={s.channelCard} onPress={() => setActive(ch)}>
            <View style={s.channelAvatar}><Text style={s.avatarText}>{ch.name[0]}</Text></View>
            <View style={s.channelInfo}>
              <Text style={s.channelName}>{ch.name}</Text>
              <Text style={s.channelProject}>{ch.projects?.name ?? ch.type}</Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {/* Chat header */}
      <View style={s.chatHeader}>
        <TouchableOpacity onPress={() => setActive(null)} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={s.chatAvatar}><Text style={s.avatarText}>{active.name[0]}</Text></View>
        <View>
          <Text style={s.chatName}>{active.name}</Text>
          <Text style={s.chatSub}>{active.projects?.name ?? active.type}</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={s.msgList} contentContainerStyle={{ padding:16, gap:10 }}>
        {messages.map((m, i) => {
          const isMe = m.sender_id === userId;
          return (
            <View key={m.id ?? i} style={[s.msgWrap, isMe && s.msgWrapMe]}>
              {!isMe && <Text style={s.senderName}>{m.profiles?.full_name?.split(" ")[0] ?? "User"}</Text>}
              <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{m.content}</Text>
              </View>
              <Text style={[s.msgTime, isMe && { textAlign:"right" }]}>
                {new Date(m.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.msgInput} value={input} onChangeText={setInput}
          placeholder="Type a message…" placeholderTextColor="#555"
          multiline onSubmitEditing={send}
        />
        <TouchableOpacity style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]} onPress={send} disabled={!input.trim()}>
          <Text style={s.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex:1, backgroundColor:"#08080A" },
  header:       { padding:24, paddingTop:60 },
  title:        { fontSize:28, fontWeight:"900", color:"#F5F5F5" },
  sub:          { fontSize:13, color:"#6B7280", marginTop:4 },
  empty:        { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:16, padding:40, alignItems:"center", borderWidth:1, borderColor:"#222226", borderStyle:"dashed" },
  emptyIcon:    { fontSize:40, marginBottom:12 },
  emptyText:    { color:"#6B7280", fontSize:15, fontWeight:"600" },
  emptyHint:    { color:"#374151", fontSize:12, marginTop:8, textAlign:"center" },
  channelCard:  { marginHorizontal:24, backgroundColor:"#0E0E10", borderRadius:14, padding:16, borderWidth:1, borderColor:"#222226", marginBottom:10, flexDirection:"row", alignItems:"center", gap:12 },
  channelAvatar:{ width:44, height:44, borderRadius:22, backgroundColor:"#F4651922", borderWidth:1, borderColor:"#F46519", alignItems:"center", justifyContent:"center" },
  avatarText:   { color:"#F46519", fontWeight:"800", fontSize:16 },
  channelInfo:  { flex:1 },
  channelName:  { color:"#F5F5F5", fontWeight:"700", fontSize:15 },
  channelProject:{ color:"#6B7280", fontSize:12, marginTop:2 },
  chevron:      { fontSize:24, color:"#6B7280" },
  chatHeader:   { flexDirection:"row", alignItems:"center", gap:12, padding:16, paddingTop:60, backgroundColor:"#0E0E10", borderBottomWidth:1, borderColor:"#222226" },
  backBtn:      { padding:4 },
  backText:     { color:"#F46519", fontSize:28, fontWeight:"300" },
  chatAvatar:   { width:36, height:36, borderRadius:18, backgroundColor:"#F4651922", alignItems:"center", justifyContent:"center" },
  chatName:     { color:"#F5F5F5", fontWeight:"700", fontSize:16 },
  chatSub:      { color:"#6B7280", fontSize:12 },
  msgList:      { flex:1 },
  msgWrap:      { maxWidth:"80%" },
  msgWrapMe:    { alignSelf:"flex-end" },
  senderName:   { color:"#F46519", fontSize:11, fontWeight:"700", marginBottom:4 },
  bubble:       { borderRadius:16, padding:12 },
  bubbleMe:     { backgroundColor:"#F46519", borderBottomRightRadius:4 },
  bubbleThem:   { backgroundColor:"#0E0E10", borderWidth:1, borderColor:"#222226", borderBottomLeftRadius:4 },
  bubbleText:   { color:"#F5F5F5", fontSize:14, lineHeight:20 },
  bubbleTextMe: { color:"#fff" },
  msgTime:      { color:"#374151", fontSize:10, marginTop:4 },
  inputRow:     { flexDirection:"row", padding:12, gap:10, backgroundColor:"#0E0E10", borderTopWidth:1, borderColor:"#222226" },
  msgInput:     { flex:1, backgroundColor:"#08080A", borderWidth:1, borderColor:"#222226", borderRadius:20, paddingHorizontal:16, paddingVertical:10, color:"#F5F5F5", fontSize:14, maxHeight:100 },
  sendBtn:      { width:44, height:44, borderRadius:22, backgroundColor:"#F46519", alignItems:"center", justifyContent:"center" },
  sendBtnDisabled:{ backgroundColor:"#222226" },
  sendIcon:     { color:"#fff", fontSize:16 },
});
