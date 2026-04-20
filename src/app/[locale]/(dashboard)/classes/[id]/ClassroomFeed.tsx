'use client';

import {
  FileText,
  Image as ImageIcon,
  Mic,
  CalendarClock,
  Trash2,
  Paperclip,
  Send,
  X,
  Pencil,
  Check,
  StopCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ChangeEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { postClassMessage, deleteClassMessage, updateClassMessage } from './actions';
import { getAttachmentSignedUrl } from '@/app/[locale]/(dashboard)/communication/messages/actions';
import type { UiAnnouncement } from '@/lib/queries/announcements';

interface Props {
  classId: string;
  currentUserId: string;
  items: UiAnnouncement[];
  canPost: boolean;
  canManage: boolean;
}

function AudioPlayer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAttachmentSignedUrl(path).then((res) => {
      if (res.ok && res.data && active) setUrl(res.data.url);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) return <div className="h-10 w-48 animate-pulse rounded bg-[hsl(var(--muted))]" />;
  return <audio controls className="h-10 w-full max-w-[300px]" src={url} />;
}

export function ClassroomFeed({ classId, currentUserId, items, canPost, canManage }: Props) {
  const t = useTranslations('communication.messages'); // For upload UI
  const tCommon = useTranslations('common');
  const tClasses = useTranslations('classes');
  const router = useRouter();
  const supabase = createClient();

  const [feed, setFeed] = useState<UiAnnouncement[]>(items);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPosting, startPosting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFeed(items);
  }, [items]);

  useEffect(() => {
    const channel = supabase
      .channel(`class-feed-${classId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcement_target_classes', filter: `class_id=eq.${classId}` },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, router, supabase]);

  async function handlePost() {
    if (!draft.trim() && attachments.length === 0) return;
    
    setError(null);
    startPosting(async () => {
      const formData = new FormData();
      formData.append('classId', classId);
      if (draft.trim()) formData.append('body', draft.trim());
      attachments.forEach((file) => {
        formData.append('files', file);
      });

      const res = await postClassMessage(formData);
      if (!res.ok) {
        setError(res.error ?? 'Failed to post message');
        return;
      }
      
      // Wait for reload (realtime update handles it perfectly via supabase channel)
      setDraft('');
      setAttachments([]);
    });
  }

  function handleFilePick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setAttachments((prev) => [...prev, ...files]);
    }
    e.target.value = '';
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        stream.getTracks().forEach((tr) => tr.stop());
        const ext = (mr.mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: blob.type,
        });
        setAttachments((prev) => [...prev, file]);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (e) {
      setError('Impossible d\'accéder au microphone');
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    setIsRecording(false);
  }

  async function downloadAttachment(path: string | null) {
    if (!path) return;
    const res = await getAttachmentSignedUrl(path);
    if (res.ok && res.data) {
      window.open(res.data.url, '_blank');
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    const id = toDelete;
    setToDelete(null);
    
    startPosting(async () => {
      const res = await deleteClassMessage(id, classId);
      if (res.ok) {
        setFeed((prev) => prev.filter((a) => a.id !== id));
      } else {
        setError(res.error ?? 'Failed to delete');
      }
    });
  }

  function startEdit(post: UiAnnouncement) {
    setEditingId(post.id);
    setEditDraft(post.body || '');
  }

  async function handleSaveEdit(post: UiAnnouncement) {
    if (!editDraft.trim()) return;
    
    startPosting(async () => {
      const res = await updateClassMessage(post.id, classId, editDraft);
      if (res.ok) {
        setFeed((prev) => prev.map((a) => a.id === post.id ? { ...a, body: editDraft.trim() } : a));
        setEditingId(null);
      } else {
        setError(res.error ?? 'Failed to update');
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {canPost && (
        <Card className="p-4 shadow-sm">
          <div className="flex flex-col gap-3">
            <Textarea 
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrivez un message ou partagez un devoir avec la classe..."
              className="resize-none"
              rows={3}
              disabled={isPosting}
            />
            
            {attachments.length > 0 && (
              <div className="flex flex-col gap-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center justify-between rounded bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--foreground))]">
                    <div className="flex items-center gap-2 truncate">
                      {file.type.startsWith('audio/') ? (
                         <Mic className="h-4 w-4 shrink-0 text-brand-500" />
                      ) : file.type.startsWith('image/') ? (
                         <ImageIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      ) : (
                         <Paperclip className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      )}
                      <span className="truncate">{file.name}</span>
                    </div>
                    <button 
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded-full p-1 hover:bg-[hsl(var(--card))] shrink-0"
                      disabled={isPosting}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFilePick}
                  disabled={isPosting}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPosting || isRecording}
                >
                  <Paperclip className="h-4 w-4 md:me-2" />
                  <span className="hidden md:inline">Joindre un fichier</span>
                </Button>

                {isRecording ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopRecording}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <StopCircle className="h-4 w-4 md:me-2 animate-pulse" />
                    <span className="hidden md:inline">Arrêter l'enregistrement</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startRecording}
                    disabled={isPosting}
                  >
                    <Mic className="h-4 w-4 md:me-2" />
                    <span className="hidden md:inline">Audio</span>
                  </Button>
                )}
              </div>

              <Button size="sm" onClick={handlePost} disabled={isPosting || (!draft.trim() && attachments.length === 0) || isRecording}>
                <Send className="h-4 w-4 me-2" />
                {isPosting ? 'En cours...' : 'Publier'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {feed.length === 0 ? (
        <EmptyState 
          icon={FileText}
          title="Espace Classe Vide"
          description="Aucun devoir, document ou message n'a encore été partagé avec cette classe."
        />
      ) : (
        <div className="space-y-4">
          {feed.map((post) => (
            <Card key={post.id} className="p-5 flex flex-col gap-3 relative border-l-4 border-l-brand-500">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Avatar name={post.author?.fullName || 'Utilisateur'} size={36} />
                  <div>
                    <h4 className="font-semibold text-sm">{post.author?.fullName || 'Utilisateur'}</h4>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(post.publishedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                
                {(canManage || post.author?.id === currentUserId) && (
                  <div className="flex items-center gap-1">
                    {post.author?.id === currentUserId && (
                       <Button
                         variant="ghost"
                         size="icon"
                         onClick={() => startEdit(post)}
                         disabled={isPosting}
                         className="text-[hsl(var(--muted-foreground))] hover:text-brand-600 shrink-0 h-8 w-8"
                       >
                         <Pencil className="h-4 w-4" />
                       </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setToDelete(post.id)}
                      disabled={isPosting}
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-600 shrink-0 h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {editingId === post.id ? (
                <div className="mt-2 flex flex-col gap-2">
                  <Textarea 
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="resize-none text-sm"
                    rows={3}
                    disabled={isPosting}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(null)} disabled={isPosting}>
                      <X className="h-4 w-4 me-1" /> Annuler
                    </Button>
                    <Button size="sm" onClick={() => handleSaveEdit(post)} disabled={isPosting || !editDraft.trim()}>
                      <Check className="h-4 w-4 me-1" /> Enregistrer
                    </Button>
                  </div>
                </div>
              ) : post.body ? (
                <p className="whitespace-pre-wrap text-sm text-[hsl(var(--foreground))] mt-2">
                  {post.body}
                </p>
              ) : null}

              {post.attachments && post.attachments.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {post.attachments.map((att, i) => (
                    <div key={i}>
                      {att.type === 'audio' && att.path ? (
                         <div className="flex items-center rounded-lg border bg-[hsl(var(--muted))]/50 p-2 border-brand-200 dark:border-brand-900">
                           <Mic className="h-5 w-5 text-brand-600 me-3 ms-2 shrink-0" />
                           <AudioPlayer path={att.path} />
                         </div>
                      ) : (
                        <div 
                          className="flex items-center gap-3 rounded-lg border bg-[hsl(var(--muted))] p-3 cursor-pointer hover:bg-[hsl(var(--border))]/30 transition-colors"
                          onClick={() => downloadAttachment(att.path)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                            {att.type === 'image' ? (
                              <ImageIcon className="h-5 w-5" />
                            ) : (
                              <FileText className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{att.name}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              Cliquez pour {att.type === 'image' ? 'voir' : 'télécharger'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer la publication"
        message="Voulez-vous vraiment supprimer ce message envoyé à la classe ?"
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
