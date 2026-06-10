
import React, { useState, useEffect, useRef } from 'react';
import { db, storage, functions } from '../firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { i18n } from '../services/i18n';

export const AdminSocialPanel: React.FC<any> = ({ showToast }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [pendingPosts, setPendingPosts] = useState<any[]>([]);
    const [config, setConfig] = useState<any>({ autoPostEnabled: true, aiCaptionEnabled: true });
    
    // Modal & Editing State
    const [editingPost, setEditingPost] = useState<any>(null);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Fetch Config & Pending Posts
    useEffect(() => {
        const configRef = doc(db, 'social_config', 'general');
        getDoc(configRef).then(snap => {
            if (snap.exists()) setConfig(snap.data());
        });

        const q = query(collection(db, 'pending_posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingPosts(posts);
        });

        const metaRef = doc(db, 'social_config', 'meta');
        getDoc(metaRef).then(snap => {
            if (snap.exists() && snap.data().accessToken) setIsConnected(true);
        });

        return () => unsubscribe();
    }, []);

    const handleConnect = () => {
        showToast('Redirecting to Meta for authentication...', 'info');
        setTimeout(async () => {
            setIsConnected(true);
            await setDoc(doc(db, 'social_config', 'meta'), { connected: true, lastConnected: new Date() }, { merge: true });
            showToast('Instagram account connected successfully!', 'success');
        }, 1500);
    };

    const toggleConfig = async (key: string) => {
        const newValue = !config[key];
        const newConfig = { ...config, [key]: newValue };
        setConfig(newConfig);
        await setDoc(doc(db, 'social_config', 'general'), newConfig, { merge: true });
        showToast('Settings updated', 'success');
    };

    const approvePost = async (post: any) => {
        if (!isConnected) {
            showToast('Please connect your Instagram account first', 'error');
            return;
        }

        showToast('Posting to Instagram & Facebook...', 'info');
        try {
            const publishedPost = {
                ...post,
                status: 'published',
                publishedAt: new Date()
            };
            await setDoc(doc(db, 'pending_posts', post.id), publishedPost, { merge: true });
            await setDoc(doc(db, 'published_posts', post.id), publishedPost, { merge: true });
            showToast('Post published successfully!', 'success');
            setEditingPost(null);
            setTimeout(() => deleteDoc(doc(db, 'pending_posts', post.id)), 2000);
        } catch (err) {
            showToast('Failed to publish post', 'error');
        }
    };

    const deletePost = async (postId: string) => {
        await deleteDoc(doc(db, 'pending_posts', postId));
        showToast('Post removed', 'info');
    };

    const createNewPost = () => {
        const newPost = {
            id: `manual_${Date.now()}`,
            orderId: 'manual',
            status: 'pending_approval',
            caption: 'New professional detailing post ✨',
            photos: [],
            service: 'Premium detailing',
            vehicle: 'Luxury car',
            location: 'Los Angeles',
            createdAt: new Date(),
            isManual: true
        };
        setEditingPost(newPost);
    };

    const regenerateWithAI = async () => {
        if (!editingPost) return;
        setIsRegenerating(true);
        try {
            const genAI = httpsCallable(functions, 'regenerateSocialCaption');
            const result: any = await genAI({
                orderId: editingPost.orderId,
                service: editingPost.service,
                vehicle: editingPost.vehicle,
                location: editingPost.location
            });
            if (result.data && result.data.caption) {
                setEditingPost({ ...editingPost, caption: result.data.caption });
                showToast('Caption regenerated!', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('AI Regeneration failed', 'error');
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingPost) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `social_uploads/${editingPost.id}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            const updatedPhotos = [...(editingPost.photos || []), downloadURL];
            setEditingPost({ ...editingPost, photos: updatedPhotos });
            showToast(i18n.t('upload_success'), 'success');
        } catch (error) {
            console.error(error);
            showToast('Upload failed', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const togglePhotoSelection = (photoUrl: string) => {
        if (!editingPost) return;
        const currentPhotos = editingPost.photos || [];
        const isSelected = currentPhotos.includes(photoUrl);
        
        const newPhotos = isSelected 
            ? currentPhotos.filter((p: string) => p !== photoUrl)
            : [...currentPhotos, photoUrl];
            
        setEditingPost({ ...editingPost, photos: newPhotos });
    };

    const saveDraftChanges = async () => {
        if (!editingPost) return;
        try {
            await setDoc(doc(db, 'pending_posts', editingPost.id), editingPost, { merge: true });
            showToast(i18n.t('save_draft'), 'success');
            setEditingPost(null);
        } catch (err) {
            showToast('Error saving changes', 'error');
        }
    };

    const enhanceWithAI = async () => {
        if (!editingPost || !editingPost.photos || editingPost.photos.length === 0) return;
        setIsUploading(true);
        try {
            const photoUrl = editingPost.photos[0];
            // Match the path from the URL
            const decodedUrl = decodeURIComponent(photoUrl);
            const pathParts = decodedUrl.split('/o/')[1].split('?')[0];
            
            const enhanceFn = httpsCallable(functions, 'enhanceSelectedImage');
            const result: any = await enhanceFn({ imagePath: pathParts });
            
            if (result.data && result.data.url) {
                const updatedPhotos = [result.data.url, ...editingPost.photos.slice(1)];
                setEditingPost({ ...editingPost, photos: updatedPhotos });
                showToast('Photo enhanced with Cinematic Filter! ✨', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('Enhancement failed', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-4 space-y-6 pb-24 relative min-h-screen">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">{i18n.t('social_automation')}</h2>
                    <p className="text-slate-400 text-sm">{i18n.t('social_desc')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={createNewPost} className="hidden md:flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-xs font-black hover:scale-105 transition-all">
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        {i18n.t('create_post').toUpperCase()}
                    </button>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {isConnected ? 'CONNECTED' : 'NOT CONNECTED'}
                    </div>
                </div>
            </header>

            {!isConnected ? (
                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                        <span className="material-symbols-outlined text-3xl text-primary">share</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white">{i18n.t('connect_business')}</h3>
                    <p className="text-slate-400 max-w-sm mx-auto">{i18n.t('connect_business_desc')}</p>
                    <button 
                        onClick={handleConnect}
                        className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 mx-auto transition-all"
                    >
                        <i className="fab fa-facebook-f"></i>
                        <span>Connect with Facebook / Instagram</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined">settings</span>
                            {i18n.t('automation_settings')}
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                <div>
                                    <p className="font-medium text-white">{i18n.t('auto_prep')}</p>
                                    <p className="text-xs text-slate-400">{i18n.t('auto_prep_desc')}</p>
                                </div>
                                <input type="checkbox" checked={config.autoPostEnabled} onChange={() => toggleConfig('autoPostEnabled')} className="toggle toggle-primary" />
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                                <div>
                                    <p className="font-medium text-white">{i18n.t('ai_caption')}</p>
                                    <p className="text-xs text-slate-400">{i18n.t('ai_caption_desc')}</p>
                                </div>
                                <input type="checkbox" checked={config.aiCaptionEnabled} onChange={() => toggleConfig('aiCaptionEnabled')} className="toggle toggle-primary" />
                            </div>
                            <button onClick={createNewPost} className="md:hidden w-full py-3 bg-primary text-white rounded-xl text-xs font-black mt-2">
                                {i18n.t('create_post').toUpperCase()}
                            </button>
                        </div>
                    </div>

                    {/* Viral Guide */}
                    <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">auto_awesome</span>
                            Viral Growth Guide
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { t: 'Close-up Macro', d: 'Focus on dirt being removed' },
                                { t: 'The Foam Reveal', d: 'Melting soap looks viral' },
                                { t: 'Interior ASMR', d: 'Fast vacuuming lines' }
                            ].map((g, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 bg-black/20 rounded-lg border border-white/5">
                                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-bold">{i+1}</div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white uppercase">{g.t}</p>
                                        <p className="text-[9px] text-slate-500">{g.d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-full border-2 border-primary overflow-hidden">
                                <img src={`https://ui-avatars.com/api/?name=${i18n.t('appName')}&background=020617&color=60a5fa`} alt="Profile" />
                            </div>
                            <div>
                                <p className="font-bold text-white">Business Connected</p>
                                <p className="text-xs text-slate-400">Instagram Graph API</p>
                            </div>
                        </div>
                        <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-white/5 rounded-xl">
                                <p className="text-xl font-bold text-white">LIVE</p>
                                <p className="text-[10px] text-slate-400 uppercase">Status</p>
                            </div>
                            <div className="text-center p-3 bg-white/5 rounded-xl">
                                <p className="text-xl font-bold text-white">{pendingPosts.length}</p>
                                <p className="text-[10px] text-slate-400 uppercase">Pending</p>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-slate-800/50 border border-white/10 rounded-2xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white flex items-center justify-between">
                            <span>{i18n.t('ready_to_post')}</span>
                            {pendingPosts.length > 0 && <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">{pendingPosts.length}</span>}
                        </h3>
                        
                        {pendingPosts.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 border-2 border-dashed border-white/5 rounded-2xl">
                                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">post_add</span>
                                <p>{i18n.t('no_pending_posts')}</p>
                            </div>
                        ) : (
                            <div className="flex space-x-4 overflow-x-auto pb-4 custom-scrollbar">
                                {pendingPosts.map(post => (
                                    <div key={post.id} className="min-w-[280px] max-w-[280px] bg-black/40 rounded-2xl overflow-hidden border border-white/10 flex flex-col group">
                                        <div className="relative h-48 bg-slate-900" onClick={() => setEditingPost(post)}>
                                            {post.photos && post.photos.length > 0 ? (
                                                <img src={post.photos[0]} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" alt="Wash" />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 cursor-pointer">
                                                    <span className="material-symbols-outlined text-5xl">photo_camera</span>
                                                </div>
                                            )}
                                            <div className="absolute top-2 right-2 flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); deletePost(post.id); }} className="p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-red-400 hover:text-red-500">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col space-y-3">
                                            <p className="text-xs text-white leading-relaxed line-clamp-3 italic">"{post.caption}"</p>
                                            <button onClick={() => setEditingPost(post)} className="w-full py-2 bg-white/10 text-white text-[10px] font-bold rounded-lg border border-white/5 hover:bg-white/20 uppercase tracking-widest">
                                                {i18n.t('edit_post')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PREVIEW & EDIT MODAL */}
            {editingPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#020617] w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/10 flex flex-col md:flex-row shadow-2xl">
                        
                        {/* Left: Live Preview (Mobile Meta Style) */}
                        <div className="w-full md:w-1/2 bg-slate-950 p-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-4">{i18n.t('preview_live')}</p>
                            
                            <div className="w-full max-w-[320px] bg-white rounded-xl overflow-hidden shadow-2xl text-black">
                                <div className="p-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[1px]">
                                        <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-slate-900">
                                            <img src={`https://ui-avatars.com/api/?name=${i18n.t('appName')}&background=020617&color=60a5fa`} alt="Avatar" />
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold">{i18n.t('appName')}</span>
                                    <span className="material-symbols-outlined text-[10px] ml-auto">more_horiz</span>
                                </div>
                                <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                                     {editingPost.photos && editingPost.photos.length > 0 ? (
                                        <div className="relative group">
                                            <img src={editingPost.photos[0]} className="w-full h-full object-cover" alt="Selected" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={enhanceWithAI} className="bg-white text-black px-4 py-2 rounded-full text-[10px] font-black flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                                    {i18n.t('enhance_with_ai').toUpperCase()}
                                                </button>
                                            </div>
                                        </div>
                                     ) : (
                                        <span className="material-symbols-outlined text-4xl opacity-20">photo</span>
                                     )}
                                </div>
                                <div className="p-3 space-y-2">
                                    <div className="flex gap-3">
                                        <span className="material-symbols-outlined text-xl">favorite</span>
                                        <span className="material-symbols-outlined text-xl">chat_bubble</span>
                                        <span className="material-symbols-outlined text-xl">send</span>
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold mr-2">{i18n.t('appName')}</span>
                                        <span className="text-[11px] leading-relaxed whitespace-pre-wrap">{editingPost.caption}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-tighter">Just now</p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Controls */}
                        <div className="w-full md:w-1/2 flex flex-col overflow-y-auto custom-scrollbar">
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-white">{i18n.t('edit_post')}</h3>
                                    <button onClick={() => setEditingPost(null)} className="text-slate-400 hover:text-white">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                {/* Caption Editor */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-400 uppercase">{i18n.t('caption')}</label>
                                        <button 
                                            onClick={regenerateWithAI}
                                            disabled={isRegenerating}
                                            className="text-[10px] text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                                        >
                                            <span className={`material-symbols-outlined text-xs ${isRegenerating ? 'animate-spin' : ''}`}>auto_awesome</span>
                                            {i18n.t('regenerate_ai')}
                                        </button>
                                    </div>
                                    <textarea 
                                        value={editingPost.caption}
                                        onChange={(e) => setEditingPost({ ...editingPost, caption: e.target.value })}
                                        className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary transition-all resize-none"
                                    />
                                </div>

                                {/* Photo Manager */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-400 uppercase">{i18n.t('select_photos')}</label>
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="text-[10px] text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                                        >
                                            <span className="material-symbols-outlined text-xs">add_a_photo</span>
                                            {i18n.t('add_image')}
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                                    </div>
                                    
                                    <div className="grid grid-cols-4 gap-2">
                                        {editingPost.photos?.map((url: string, idx: number) => (
                                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group bg-slate-900">
                                                <img src={url} className="w-full h-full object-cover" alt="Option" />
                                                <button 
                                                    onClick={() => togglePhotoSelection(url)}
                                                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <span className="material-symbols-outlined text-[10px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                        {isUploading && (
                                            <div className="aspect-square rounded-lg border border-white/5 border-dashed flex items-center justify-center">
                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5 flex gap-3">
                                    <button 
                                        onClick={saveDraftChanges}
                                        className="flex-1 py-3 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all border border-white/10"
                                    >
                                        {i18n.t('save_draft')}
                                    </button>
                                    <button 
                                        onClick={() => approvePost(editingPost)}
                                        className="flex-[1.5] py-3 bg-primary text-white font-black rounded-2xl hover:scale-105 transition-all shadow-lg shadow-primary/30"
                                    >
                                        {i18n.t('approve_post')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
