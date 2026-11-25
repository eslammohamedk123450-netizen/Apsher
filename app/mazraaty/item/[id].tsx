import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  ActionSheet,
  type ActionSheetAction,
} from "@/components/mazraaty/action-sheet";
import { AppHeader } from "@/components/mazraaty/app-header";
import { AudioBubble } from "@/components/mazraaty/audio-bubble";
import { Barcode } from "@/components/barcode";
import { BottomSheet } from "@/components/mazraaty/bottom-sheet";
import { confirmAction } from "@/components/mazraaty/confirm";
import { MZ } from "@/components/mazraaty/theme";
import { useVoiceRecorder } from "@/components/mazraaty/use-voice-recorder";
import { ScreenContainer } from "@/components/screen-container";
import {
  formatDuration,
  formatNoteDay,
  formatNoteTime,
  useMazraaty,
  type MazraatyNote,
  type MazraatyNoteChange,
} from "@/lib/mazraaty-store";

const NOTE_CHANGE_LABELS: Record<MazraatyNoteChange, string> = {
  "edit-text": "النص السابق",
  "replace-image": "الصورة السابقة",
  "remove-image": "الصورة التي حُذفت",
  "replace-audio": "التسجيل السابق",
  "remove-audio": "التسجيل الذي حُذف",
};

export default function MazraatyItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data,
    ready,
    addNote,
    removeNote,
    archiveNote,
    updateNote,
    archiveItem,
    removeItem,
    chooseImage,
    saveAudio,
  } = useMazraaty();

  const scrollRef = useRef<ScrollView>(null);
  const voice = useVoiceRecorder();

  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<MazraatyNote | null>(null);
  const [itemMenu, setItemMenu] = useState(false);
  const [noteEdit, setNoteEdit] = useState<MazraatyNote | null>(null);
  const [noteEditText, setNoteEditText] = useState("");
  const [historyFor, setHistoryFor] = useState<MazraatyNote | null>(null);
  const [replaceVoiceFor, setReplaceVoiceFor] = useState<string | null>(null);

  const item = data.items.find((i) => i.id === id);
  const section = data.sections.find((s) => s.id === item?.sectionId);
  const notes = data.notes
    .filter((n) => n.itemId === id && !n.archivedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const alertError = (message: string) => {
    if (typeof window !== "undefined") window.alert(message);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/mazraaty");
  };

  if (!ready) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={MZ.green} />
        </View>
      </ScreenContainer>
    );
  }

  if (!item) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.root}>
          <AppHeader
            title="عنصر غير موجود"
            onBack={goBack}
            onLauncher={() => router.replace("/")}
          />
          <View style={styles.center}>
            <Text style={styles.mutedText}>هذا العنصر لم يعد موجودًا.</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addNote({ itemId: item.id, kind: "text", text: trimmed });
    setText("");
  };

  const sendImage = async () => {
    try {
      setPicking(true);
      const uri = await chooseImage();
      if (uri) addNote({ itemId: item.id, kind: "image", imageUri: uri });
    } catch (error) {
      alertError(
        error instanceof Error ? error.message : "تعذر اختيار الصورة",
      );
    } finally {
      setPicking(false);
    }
  };

  const sendVoice = async () => {
    const recorded = await voice.stop();
    if (!recorded) return;
    const targetId = replaceVoiceFor;
    setReplaceVoiceFor(null);
    try {
      setSendingVoice(true);
      const stored = await saveAudio(recorded.uri);
      if (!stored) {
        alertError("تعذر حفظ التسجيل الصوتي.");
        return;
      }
      if (targetId)
        updateNote(
          targetId,
          { audioUri: stored, durationMs: recorded.durationMs },
          "replace-audio",
        );
      else
        addNote({
          itemId: item.id,
          kind: "voice",
          audioUri: stored,
          durationMs: recorded.durationMs,
        });
    } finally {
      setSendingVoice(false);
    }
  };

  const openNoteEdit = (note: MazraatyNote) => {
    setNoteEdit(note);
    setNoteEditText(note.text ?? "");
  };

  const saveNoteEdit = () => {
    if (!noteEdit) return;
    const trimmed = noteEditText.trim();
    if (!trimmed) return;
    updateNote(noteEdit.id, { text: trimmed }, "edit-text");
    setNoteEdit(null);
  };

  const replaceNoteImage = async (note: MazraatyNote) => {
    try {
      setPicking(true);
      const uri = await chooseImage();
      if (uri) updateNote(note.id, { imageUri: uri }, "replace-image");
    } catch (error) {
      alertError(
        error instanceof Error ? error.message : "تعذر اختيار الصورة",
      );
    } finally {
      setPicking(false);
    }
  };

  const startReplaceVoice = (note: MazraatyNote) => {
    setReplaceVoiceFor(note.id);
    void voice.start();
  };

  const noteActions = (note: MazraatyNote): ActionSheetAction[] => {
    const actions: ActionSheetAction[] = [];
    if (note.kind === "text") {
      actions.push({
        icon: "create-outline",
        label: "تعديل الملاحظة",
        onPress: () => openNoteEdit(note),
      });
    }
    if (note.kind === "image") {
      actions.push({
        icon: "image-outline",
        label: note.imageUri ? "استبدال الصورة" : "إضافة صورة",
        onPress: () => void replaceNoteImage(note),
      });
      if (note.imageUri)
        actions.push({
          icon: "trash-outline",
          label: "حذف الصورة",
          danger: true,
          onPress: () =>
            confirmAction(
              "سيتم حذف الصورة من الملاحظة مع إمكانية الرجوع لسجل التعديلات. متأكد؟",
              () => updateNote(note.id, { imageUri: null }, "remove-image"),
            ),
        });
    }
    if (note.kind === "voice") {
      actions.push({
        icon: "mic-outline",
        label: note.audioUri ? "إعادة التسجيل" : "إضافة تسجيل",
        onPress: () => startReplaceVoice(note),
      });
      if (note.audioUri)
        actions.push({
          icon: "trash-outline",
          label: "حذف التسجيل",
          danger: true,
          onPress: () =>
            confirmAction(
              "سيتم حذف التسجيل الصوتي مع إمكانية الرجوع لسجل التعديلات. متأكد؟",
              () => updateNote(note.id, { audioUri: null }, "remove-audio"),
            ),
        });
    }
    actions.push({
      icon: "archive-outline",
      label: "أرشفة الملاحظة",
      onPress: () =>
        confirmAction(
          "سيتم نقل هذه الملاحظة إلى الأرشيف. متأكد؟",
          () => archiveNote(note.id, true),
          "أرشفة",
        ),
    });
    actions.push({
      icon: "trash-outline",
      label: "حذف الملاحظة",
      danger: true,
      onPress: () =>
        confirmAction("سيتم نقل هذه الملاحظة إلى المحذوفات. متأكد؟", () =>
          removeNote(note.id),
        ),
    });
    if (note.editedAt || (note.history?.length ?? 0) > 0)
      actions.push({
        icon: "time-outline",
        label: "عرض التعديلات السابقة",
        onPress: () => setHistoryFor(note),
      });
    return actions;
  };

  const noteFooter = (note: MazraatyNote) => (
    <View style={styles.noteFooter}>
      <Text style={styles.bubbleTime}>{formatNoteTime(note.createdAt)}</Text>
      {note.editedAt ? (
        <Pressable
          style={styles.editedBadge}
          onPress={() => setHistoryFor(note)}
          hitSlop={6}
          accessibilityLabel="عرض سجل التعديلات"
        >
          <Ionicons name="create-outline" size={11} color={MZ.green} />
          <Text style={styles.editedText}>معدلة</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderNote = (note: MazraatyNote, showDay: boolean) => (
    <View key={note.id} style={styles.noteWrap}>
      {showDay ? (
        <View style={styles.dayRow}>
          <Text style={styles.dayText}>{formatNoteDay(note.createdAt)}</Text>
        </View>
      ) : null}

      <Pressable
        onLongPress={() => setMenuFor(note)}
        delayLongPress={320}
      >
        {note.kind === "text" ? (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{note.text}</Text>
            {noteFooter(note)}
          </View>
        ) : null}

        {note.kind === "image" ? (
          <View style={styles.imageBubble}>
            {note.imageUri ? (
              <Pressable onPress={() => setViewerUri(note.imageUri!)}>
                <Image
                  source={{ uri: note.imageUri }}
                  style={styles.noteImage}
                />
              </Pressable>
            ) : (
              <View style={styles.removedImage}>
                <Ionicons name="image-outline" size={26} color={MZ.muted} />
                <Text style={styles.removedText}>تم حذف الصورة</Text>
              </View>
            )}
            {noteFooter(note)}
          </View>
        ) : null}

        {note.kind === "voice" ? (
          <View style={styles.bubble}>
            {note.audioUri ? (
              <AudioBubble uri={note.audioUri} durationMs={note.durationMs} />
            ) : (
              <View style={styles.removedVoice}>
                <Ionicons name="mic-off-outline" size={18} color={MZ.muted} />
                <Text style={styles.removedText}>تم حذف التسجيل</Text>
              </View>
            )}
            {noteFooter(note)}
          </View>
        ) : null}
      </Pressable>
    </View>
  );

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppHeader
          title={item.name}
          subtitle={section ? section.name : undefined}
          onBack={goBack}
          onLauncher={() => router.replace("/")}
          right={
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/mazraaty/item-form",
                  params: { id: item.id },
                })
              }
              style={styles.headerIcon}
              hitSlop={6}
              accessibilityLabel="تعديل العنصر"
            >
              <Ionicons name="create-outline" size={19} color={MZ.green} />
            </Pressable>
          }
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={false}
        >
          {/* بطاقة العنصر */}
          <Pressable
            style={styles.summary}
            onLongPress={() => setItemMenu(true)}
            delayLongPress={320}
          >
            <View style={styles.summaryRow}>
              {item.imageUri ? (
                <Image
                  source={{ uri: item.imageUri }}
                  style={styles.summaryImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.summaryImg, styles.summaryPlaceholder]}>
                  <Ionicons name="cube-outline" size={40} color={MZ.green} />
                </View>
              )}
              <View style={styles.summaryBody}>
                <Text style={styles.summaryName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.summaryDesc}>{item.description}</Text>
                ) : null}
                <Text style={styles.summaryMeta}>
                  {notes.length} ملاحظة · اضغط مطوّلًا للخيارات
                </Text>
              </View>
            </View>
            <View style={styles.barcodeRow}>
              <Barcode
                value={item.barcode}
                format="CODE128"
                height={42}
                maxWidth={240}
              />
            </View>
            <Text style={styles.barcodeCode}>{item.barcode}</Text>
          </Pressable>

          {notes.length === 0 ? (
            <View style={styles.notesEmpty}>
              <Ionicons
                name="chatbubbles-outline"
                size={30}
                color={MZ.green}
              />
              <Text style={styles.notesEmptyText}>
                لا توجد ملاحظات بعد. اكتب أول ملاحظة بالأسفل — نص، صورة، أو
                تسجيل صوتي.
              </Text>
            </View>
          ) : (
            <View style={styles.notes}>
              {notes.map((note, index) => {
                const day = new Date(note.createdAt).toDateString();
                const prevDay =
                  index > 0
                    ? new Date(notes[index - 1].createdAt).toDateString()
                    : null;
                return renderNote(note, day !== prevDay);
              })}
            </View>
          )}
        </ScrollView>

        {/* شريط الكتابة */}
        {voice.isRecording ? (
          <View style={styles.composer}>
            <Pressable
              style={styles.composerIcon}
              onPress={() => {
                setReplaceVoiceFor(null);
                void voice.cancel();
              }}
              hitSlop={6}
              accessibilityLabel="إلغاء التسجيل"
            >
              <Ionicons name="trash-outline" size={22} color={MZ.danger} />
            </Pressable>
            <View style={styles.recordingInfo}>
              <View style={styles.redDot} />
              <Text style={styles.recordingTime}>
                {formatDuration(voice.durationMs)}
              </Text>
              <Text style={styles.recordingHint}>
                {replaceVoiceFor ? "إعادة تسجيل..." : "جاري التسجيل..."}
              </Text>
            </View>
            <Pressable
              style={[styles.sendBtn, sendingVoice && { opacity: 0.6 }]}
              onPress={() => void sendVoice()}
              disabled={sendingVoice}
              hitSlop={6}
              accessibilityLabel="إرسال التسجيل"
            >
              {sendingVoice ? (
                <ActivityIndicator color={MZ.white} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={MZ.white} />
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.composer}>
            <Pressable
              style={styles.composerIcon}
              onPress={sendImage}
              disabled={picking}
              hitSlop={6}
              accessibilityLabel="إضافة صورة"
            >
              {picking ? (
                <ActivityIndicator color={MZ.green} size="small" />
              ) : (
                <Ionicons name="image-outline" size={24} color={MZ.green} />
              )}
            </Pressable>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="اكتب ملاحظة..."
              placeholderTextColor="#9AA7B8"
              style={styles.composerInput}
              multiline
              onSubmitEditing={sendText}
              blurOnSubmit={false}
            />

            {text.trim() ? (
              <Pressable
                style={styles.sendBtn}
                onPress={sendText}
                hitSlop={6}
                accessibilityLabel="إرسال الملاحظة"
              >
                <Ionicons name="send" size={18} color={MZ.white} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.micBtn}
                onPress={() => void voice.start()}
                disabled={voice.busy}
                hitSlop={6}
                accessibilityLabel="تسجيل صوتي"
              >
                {voice.busy ? (
                  <ActivityIndicator color={MZ.white} size="small" />
                ) : (
                  <Ionicons name="mic" size={22} color={MZ.white} />
                )}
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* عارض الصورة */}
      {viewerUri ? (
        <Pressable style={styles.viewer} onPress={() => setViewerUri(null)}>
          <Image
            source={{ uri: viewerUri }}
            style={styles.viewerImg}
            resizeMode="contain"
          />
          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerUri(null)}
            hitSlop={8}
          >
            <Ionicons name="close" size={26} color={MZ.white} />
          </Pressable>
        </Pressable>
      ) : null}

      {/* قائمة خيارات الملاحظة */}
      <ActionSheet
        visible={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        actions={menuFor ? noteActions(menuFor) : []}
      />

      {/* قائمة خيارات العنصر */}
      <ActionSheet
        visible={itemMenu}
        title={item.name}
        onClose={() => setItemMenu(false)}
        actions={[
          {
            icon: "create-outline",
            label: "تعديل العنصر",
            onPress: () =>
              router.push({
                pathname: "/mazraaty/item-form",
                params: { id: item.id },
              }),
          },
          {
            icon: "archive-outline",
            label: "أرشفة العنصر",
            onPress: () =>
              confirmAction(
                `سيتم نقل عنصر «${item.name}» إلى الأرشيف. متأكد؟`,
                () => {
                  archiveItem(item.id, true);
                  goBack();
                },
                "أرشفة",
              ),
          },
          {
            icon: "trash-outline",
            label: "حذف العنصر",
            danger: true,
            onPress: () =>
              confirmAction(
                `سيتم نقل عنصر «${item.name}» وكل ملاحظاته إلى المحذوفات. متأكد؟`,
                () => {
                  removeItem(item.id);
                  router.replace("/mazraaty");
                },
              ),
          },
        ]}
      />

      {/* تعديل نص الملاحظة */}
      <BottomSheet
        visible={Boolean(noteEdit)}
        title="تعديل الملاحظة"
        onClose={() => setNoteEdit(null)}
      >
        <Text style={styles.label}>نص الملاحظة</Text>
        <TextInput
          value={noteEditText}
          onChangeText={setNoteEditText}
          style={[styles.input, styles.textArea]}
          multiline
          autoFocus
        />
        <Pressable
          style={({ pressed }) => [
            styles.primaryBtn,
            !noteEditText.trim() && styles.primaryBtnDisabled,
            pressed && { opacity: 0.88 },
          ]}
          onPress={saveNoteEdit}
          disabled={!noteEditText.trim()}
        >
          <Text style={styles.primaryBtnText}>حفظ التعديل</Text>
        </Pressable>
      </BottomSheet>

      {/* سجل تعديلات الملاحظة */}
      <BottomSheet
        visible={Boolean(historyFor)}
        title="سجل تعديلات الملاحظة"
        onClose={() => setHistoryFor(null)}
      >
        {historyFor && (historyFor.history?.length ?? 0) > 0 ? (
          [...(historyFor.history ?? [])]
            .reverse()
            .map((revision, index) => (
              <View
                key={`${revision.at}-${index}`}
                style={styles.historyItem}
              >
                <View style={styles.historyHead}>
                  <Text style={styles.historyLabel}>
                    {NOTE_CHANGE_LABELS[revision.change]}
                  </Text>
                  <Text style={styles.historyTime}>
                    {formatNoteDay(revision.at)} ·{" "}
                    {formatNoteTime(revision.at)}
                  </Text>
                </View>
                {revision.imageUri ? (
                  <Image
                    source={{ uri: revision.imageUri }}
                    style={styles.historyImage}
                    resizeMode="cover"
                  />
                ) : null}
                {revision.audioUri ? (
                  <AudioBubble
                    uri={revision.audioUri}
                    durationMs={revision.durationMs}
                  />
                ) : null}
                {revision.text ? (
                  <Text style={styles.historyText}>{revision.text}</Text>
                ) : null}
                {!revision.imageUri && !revision.audioUri && !revision.text ? (
                  <Text style={styles.historyEmpty}>لا يوجد محتوى سابق.</Text>
                ) : null}
              </View>
            ))
        ) : (
          <Text style={styles.historyEmpty}>لا يوجد سجل تعديلات بعد.</Text>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: MZ.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mutedText: { color: MZ.muted, fontSize: 14 },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },

  summary: {
    backgroundColor: MZ.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: MZ.border,
    padding: 12,
    gap: 8,
  },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryImg: { width: 92, height: 92, borderRadius: 14 },
  summaryPlaceholder: {
    backgroundColor: MZ.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBody: { flex: 1, gap: 4, justifyContent: "center" },
  summaryName: {
    color: MZ.navy,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
  },
  summaryDesc: {
    color: MZ.navy,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "right",
  },
  summaryMeta: { color: MZ.muted, fontSize: 11, textAlign: "right" },
  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  barcodeCode: {
    color: MZ.muted,
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
  },

  notesEmpty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 34,
    paddingHorizontal: 16,
  },
  notesEmptyText: {
    color: MZ.muted,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },

  notes: { gap: 10 },
  noteWrap: { gap: 10 },
  dayRow: { alignItems: "center", paddingVertical: 4 },
  dayText: {
    color: MZ.muted,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: MZ.chip,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
    textAlign: "center",
  },

  bubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    backgroundColor: MZ.greenSoft,
    borderWidth: 1,
    borderColor: "#CDEADB",
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 4,
  },
  bubbleText: {
    color: MZ.navy,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "right",
  },
  bubbleTime: {
    color: MZ.muted,
    fontSize: 10,
    textAlign: "left",
    alignSelf: "flex-start",
  },
  noteFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  editedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: MZ.greenSoft,
    borderWidth: 1,
    borderColor: "#CDEADB",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  editedText: { color: MZ.green, fontSize: 9, fontWeight: "800" },
  removedImage: {
    width: 210,
    height: 130,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#C8D7E8",
    backgroundColor: MZ.chip,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  removedVoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 190,
    paddingVertical: 4,
  },
  removedText: { color: MZ.muted, fontSize: 12, fontWeight: "700" },

  imageBubble: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    backgroundColor: MZ.white,
    borderRadius: 16,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: MZ.border,
    padding: 5,
    gap: 4,
  },
  noteImage: { width: 210, height: 210, borderRadius: 12 },

  historyItem: {
    borderWidth: 1,
    borderColor: MZ.border,
    borderRadius: 14,
    backgroundColor: MZ.white,
    padding: 10,
    gap: 8,
  },
  historyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  historyLabel: { color: MZ.navy, fontSize: 13, fontWeight: "900" },
  historyTime: { color: MZ.muted, fontSize: 10 },
  historyImage: { width: "100%", height: 160, borderRadius: 10 },
  historyText: {
    color: MZ.navy,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "right",
  },
  historyEmpty: {
    color: MZ.muted,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 6,
  },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: MZ.white,
    borderTopWidth: 1,
    borderTopColor: MZ.border,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  composerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: MZ.chip,
    color: MZ.navy,
    fontSize: 14,
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 11,
    textAlign: "right",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MZ.green,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MZ.green,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#E53E3E" },
  recordingTime: { color: MZ.navy, fontSize: 15, fontWeight: "800" },
  recordingHint: { color: MZ.muted, fontSize: 12 },

  viewer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(9,17,28,0.94)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 80,
  },
  viewerImg: { width: "100%", height: "80%" },
  viewerClose: {
    position: "absolute",
    top: 42,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    color: MZ.navy,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C8D7E8",
    backgroundColor: MZ.white,
    color: MZ.navy,
    fontSize: 15,
    paddingHorizontal: 14,
    textAlign: "right",
  },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: MZ.green,
    minHeight: 52,
    borderRadius: 16,
  },
  primaryBtnDisabled: { backgroundColor: "#9DB9AB" },
  primaryBtnText: { color: MZ.white, fontSize: 15, fontWeight: "900" },
});
