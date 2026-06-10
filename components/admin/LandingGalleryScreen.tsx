import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../../firebase';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface GalleryPost {
    id: string;
    photos: string[];
    vehicle?: string;
    service?: string;
    location?: string;
    category?: string;
    caption?: string;
    publishedAt?: any;
}

interface LandingGalleryScreenProps {
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    hideHeader?: boolean;
}

export const LandingGalleryScreen: React.FC<LandingGalleryScreenProps> = ({ showToast, hideHeader }) => {
    const [posts, setPosts] = useState<GalleryPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');

    // Modals state
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // Form inputs state
    const [activePost, setActivePost] = useState<GalleryPost | null>(null);
    const [formVehicle, setFormVehicle] = useState('');
    const [formCaption, setFormCaption] = useState('');
    const [formLocation, setFormLocation] = useState('Los Angeles');
    const [formService, setFormService] = useState('Premium Wash');
    const [formCategory, setFormCategory] = useState('Detailing');
    
    // File upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Real-time fetch of gallery posts
    useEffect(() => {
        const q = query(collection(db, 'published_posts'), orderBy('publishedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as GalleryPost[];
            setPosts(fetchedPosts);
            setLoading(false);
        }, (error) => {
            console.error('Error loading gallery posts:', error);
            showToast('Failed to load gallery posts', 'error');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [showToast]);

    // Handle File Selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Open Upload Modal
    const openUploadModal = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setFormVehicle('');
        setFormCaption('');
        setFormLocation('Los Angeles');
        setFormService('Premium Detailing');
        setFormCategory('Detailing');
        setUploadModalOpen(true);
    };

    // Submit New Photo
    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            showToast('Please select an image file first', 'warning');
            return;
        }

        setUploading(true);
        try {
            // 1. Upload to storage
            const filename = `${Date.now()}_${selectedFile.name}`;
            const storageRef = ref(storage, `gallery_uploads/${filename}`);
            const snapshot = await uploadBytes(storageRef, selectedFile);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 2. Save document to firestore
            await addDoc(collection(db, 'published_posts'), {
                photos: [downloadURL],
                vehicle: formVehicle.trim(),
                caption: formCaption.trim(),
                location: formLocation.trim(),
                service: formService.trim(),
                category: formCategory,
                publishedAt: serverTimestamp()
            });

            showToast('Photo uploaded successfully to Landing Gallery!', 'success');
            setUploadModalOpen(false);
        } catch (err: any) {
            console.error('Error uploading photo:', err);
            showToast(`Upload failed: ${err.message || err}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    // Open Edit Modal
    const openEditModal = (post: GalleryPost) => {
        setActivePost(post);
        setFormVehicle(post.vehicle || '');
        setFormCaption(post.caption || '');
        setFormLocation(post.location || 'Los Angeles');
        setFormService(post.service || 'Premium Detailing');
        setFormCategory(post.category || 'Detailing');
        setEditModalOpen(true);
    };

    // Save Edit Metadata Changes
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activePost) return;

        setUploading(true);
        try {
            const docRef = doc(db, 'published_posts', activePost.id);
            await setDoc(docRef, {
                vehicle: formVehicle.trim(),
                caption: formCaption.trim(),
                location: formLocation.trim(),
                service: formService.trim(),
                category: formCategory
            }, { merge: true });

            showToast('Gallery item details updated successfully!', 'success');
            setEditModalOpen(false);
        } catch (err: any) {
            console.error('Error updating details:', err);
            showToast(`Failed to update item: ${err.message || err}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    // Open Delete Confirmation
    const openDeleteConfirm = (post: GalleryPost) => {
        setActivePost(post);
        setDeleteConfirmOpen(true);
    };

    // Execute Delete
    const handleDeleteExecute = async () => {
        if (!activePost) return;
        try {
            await deleteDoc(doc(db, 'published_posts', activePost.id));
            showToast('Gallery item deleted successfully!', 'success');
            setDeleteConfirmOpen(false);
        } catch (err: any) {
            console.error('Error deleting gallery item:', err);
            showToast(`Failed to delete: ${err.message || err}`, 'error');
        }
    };

    // Filtering logic
    const filteredPosts = posts.filter(post => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            (post.vehicle?.toLowerCase() || '').includes(query) ||
            (post.service?.toLowerCase() || '').includes(query) ||
            (post.caption?.toLowerCase() || '').includes(query) ||
            (post.location?.toLowerCase() || '').includes(query);
            
        const matchesCategory = 
            categoryFilter === 'All' || 
            post.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });

    const uniqueCategories = ['All', 'Detailing', 'Paint Correction', 'Ceramic Coating', 'Interior', 'Exterior'];

    return (
        <div className={`flex flex-col h-full bg-[#070a13] text-white ${hideHeader ? 'p-4 md:p-6 pt-2' : 'p-4 md:p-6'} pb-24 overflow-y-auto`}>
            {/* Header */}
            {!hideHeader && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                            <span className="material-symbols-outlined text-4xl text-primary">photo_library</span>
                            Landing Gallery
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">Manage the live gallery photos, titles, and descriptions shown on your public landing page.</p>
                    </div>
                    <button 
                        onClick={openUploadModal}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary text-white px-5 py-3 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 self-start sm:self-auto"
                    >
                        <span className="material-symbols-outlined text-sm font-black">add_a_photo</span>
                        ADD GALLERY PHOTO
                    </button>
                </div>
            )}

            {/* Filter and Search Bar */}
            <div className="bg-slate-800/40 border border-white/5 backdrop-blur-md p-4 rounded-3xl mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:w-80">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input 
                        type="text" 
                        placeholder="Search photos by title, vehicle, service..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-500"
                    />
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center justify-start md:justify-end">
                    {uniqueCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                categoryFilter === cat
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading Indicator */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 text-sm">Loading gallery photos...</p>
                </div>
            ) : filteredPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-800/20 border-2 border-dashed border-white/5 rounded-3xl p-8">
                    <span className="material-symbols-outlined text-5xl text-slate-600 mb-3">image_not_supported</span>
                    <p className="text-lg font-bold text-white mb-1">No images found</p>
                    <p className="text-sm text-slate-500 max-w-sm">
                        {searchQuery ? "Try refining your search filter query." : "Click the add photo button above to add images to the public gallery."}
                    </p>
                </div>
            ) : (
                <>
                    {/* Counter */}
                    <div className="text-slate-400 text-xs font-bold mb-4 uppercase tracking-widest flex items-center justify-between">
                        <span>Showing {filteredPosts.length} of {posts.length} images</span>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {filteredPosts.map(post => {
                            const photoUrl = post.photos && post.photos.length > 0 ? post.photos[0] : '';
                            const title = post.vehicle || post.service || "Premium Detailing";
                            const desc = post.caption || "No description provided.";
                            
                            return (
                                <div 
                                    key={post.id} 
                                    className="bg-slate-900/50 border border-white/10 rounded-3xl overflow-hidden flex flex-col group hover:border-primary/40 transition-all duration-300 shadow-xl"
                                >
                                    {/* Image Container */}
                                    <div className="relative aspect-video sm:aspect-square bg-black/60 overflow-hidden">
                                        {photoUrl ? (
                                            <img 
                                                src={photoUrl} 
                                                alt={title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                                                <span className="material-symbols-outlined text-4xl">broken_image</span>
                                            </div>
                                        )}
                                        
                                        {/* Overlay Buttons on Hover */}
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                                            <button 
                                                onClick={() => openEditModal(post)}
                                                className="w-10 h-10 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-white hover:bg-primary hover:border-primary transition-all duration-200"
                                                title="Edit Metadata"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button 
                                                onClick={() => openDeleteConfirm(post)}
                                                className="w-10 h-10 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-200"
                                                title="Delete Image"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Content Card */}
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-white text-base truncate" title={title}>{title}</h3>
                                            <p className="text-slate-400 text-xs line-clamp-2 italic" title={desc}>
                                                "{desc}"
                                            </p>
                                        </div>

                                        <div className="pt-4 mt-auto border-t border-white/5 flex flex-col gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[12px] text-primary">category</span>
                                                <span className="text-slate-400">{post.category || 'Detailing'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[12px] text-primary">location_on</span>
                                                <span className="text-slate-400 truncate">{post.location || 'Los Angeles'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* --- UPLOAD MODAL --- */}
            {uploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0b0f19] w-full max-w-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">add_a_photo</span>
                                Add Detailing Photo
                            </h3>
                            <button 
                                onClick={() => setUploadModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleUploadSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Upload area */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-400">Select Image File</label>
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-white/15 hover:border-primary/50 bg-white/5 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px]"
                                >
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                        className="hidden" 
                                        accept="image/*" 
                                    />
                                    {previewUrl ? (
                                        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 max-h-[160px]">
                                            <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2 text-slate-400">
                                            <span className="material-symbols-outlined text-4xl text-slate-500">cloud_upload</span>
                                            <p className="text-xs font-semibold">Click or drag an image here to upload</p>
                                            <p className="text-[10px] text-slate-500">Supports PNG, JPG, WEBP formats</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Title / Vehicle Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. Porsche 911 GT3 RS"
                                        value={formVehicle}
                                        onChange={(e) => setFormVehicle(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Service Type</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. Ceramic Coating"
                                        value={formService}
                                        onChange={(e) => setFormService(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Category</label>
                                    <select 
                                        value={formCategory}
                                        onChange={(e) => setFormCategory(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white bg-slate-900"
                                    >
                                        <option value="Detailing">Detailing</option>
                                        <option value="Paint Correction">Paint Correction</option>
                                        <option value="Ceramic Coating">Ceramic Coating</option>
                                        <option value="Interior">Interior</option>
                                        <option value="Exterior">Exterior</option>
                                    </select>
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Location</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Beverly Hills"
                                        value={formLocation}
                                        onChange={(e) => setFormLocation(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600"
                                    />
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Subtitle / Caption Description</label>
                                    <textarea 
                                        placeholder="Write a brief caption details..."
                                        value={formCaption}
                                        onChange={(e) => setFormCaption(e.target.value)}
                                        className="w-full h-24 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t border-white/5 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setUploadModalOpen(false)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={uploading || !selectedFile || !formVehicle}
                                    className="flex-[1.5] py-3 bg-primary text-white font-black rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-sm font-black">send</span>
                                            Publish to Gallery
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- EDIT MODAL --- */}
            {editModalOpen && activePost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0b0f19] w-full max-w-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">edit</span>
                                Edit Photo Titles & Details
                            </h3>
                            <button 
                                onClick={() => setEditModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Photo Thumbnail */}
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-wider text-slate-400">Current Gallery Photo</label>
                                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 max-h-[160px] bg-black/40">
                                    <img 
                                        src={activePost.photos && activePost.photos.length > 0 ? activePost.photos[0] : ''} 
                                        className="w-full h-full object-cover" 
                                        alt="Current" 
                                    />
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Title / Vehicle Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. Porsche 911 GT3 RS"
                                        value={formVehicle}
                                        onChange={(e) => setFormVehicle(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Service Type</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. Ceramic Coating"
                                        value={formService}
                                        onChange={(e) => setFormService(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Category</label>
                                    <select 
                                        value={formCategory}
                                        onChange={(e) => setFormCategory(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white bg-slate-900"
                                    >
                                        <option value="Detailing">Detailing</option>
                                        <option value="Paint Correction">Paint Correction</option>
                                        <option value="Ceramic Coating">Ceramic Coating</option>
                                        <option value="Interior">Interior</option>
                                        <option value="Exterior">Exterior</option>
                                    </select>
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Location</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Beverly Hills"
                                        value={formLocation}
                                        onChange={(e) => setFormLocation(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600"
                                    />
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-400">Subtitle / Caption Description</label>
                                    <textarea 
                                        placeholder="Write a brief caption details..."
                                        value={formCaption}
                                        onChange={(e) => setFormCaption(e.target.value)}
                                        className="w-full h-24 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary transition-all text-white placeholder-slate-600 resize-none"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t border-white/5 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setEditModalOpen(false)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={uploading || !formVehicle}
                                    className="flex-[1.5] py-3 bg-primary text-white font-black rounded-2xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-sm font-black">save</span>
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- DELETE CONFIRMATION MODAL --- */}
            {deleteConfirmOpen && activePost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0b0f19] w-full max-w-md rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-6 space-y-6">
                        <div className="flex items-center gap-3 text-red-500">
                            <span className="material-symbols-outlined text-3xl">warning</span>
                            <h3 className="text-lg font-bold text-white">Delete Gallery Photo</h3>
                        </div>
                        
                        <p className="text-sm text-slate-400">
                            Are you sure you want to delete <span className="text-white font-bold">"{activePost.vehicle || activePost.service || 'this photo'}"</span>? This action will remove it immediately from your live website gallery. This cannot be undone.
                        </p>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirmOpen(false)}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteExecute}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-600/20"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
