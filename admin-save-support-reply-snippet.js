async function saveSupportReply(ticketId, reply, button) {
  if (!ticketId) return;

  if (!reply) {
    alert("Reply likho pehle.");
    return;
  }

  setLoading(button, true);

  const { data: ticketData, error: ticketFetchError } = await supabaseClient
    .from(CONFIG.supportTable)
    .select("*")
    .eq("id", ticketId)
    .single();

  if (ticketFetchError || !ticketData) {
    setLoading(button, false);
    alert("Ticket fetch nahi hua");
    return;
  }

  const { error } = await supabaseClient
    .from(CONFIG.supportTable)
    .update({
      admin_reply: reply,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    setLoading(button, false);
    alert(`Unable to save reply: ${error.message}`);
    return;
  }

  const userId = ticketData.user_id;
  const subject = ticketData.subject || "your ticket";

  const { data: profileData, error: profileError } = await supabaseClient
    .from(CONFIG.usersTable)
    .select("fcm_token")
    .eq("id", userId)
    .single();

  if (!profileError && profileData?.fcm_token) {
    try {
      await fetch("http://localhost:4000/send-support-reply-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fcmToken: profileData.fcm_token,
          subject,
        }),
      });
    } catch (pushError) {
      console.error("Push send failed", pushError);
    }
  }

  setLoading(button, false);
  alert("Reply saved successfully");
  await loadSupportTickets();
}
