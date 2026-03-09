
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, ShoppingBag, Loader2, LogOut, LayoutGrid, Clock, PhoneCall, MapPin, Package, Gift, Layers, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, Trash2, ShoppingCart, User as UserIcon, History, XCircle, CheckCircle2, UserPlus, LogIn, Megaphone, ArrowRight, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { THEME_DATA, FestivalTheme } from '@/app/lib/constants';
import { AdminPanel } from '@/components/AdminPanel';
import { FestiveEffects } from '@/components/FestiveEffects';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { 
  useCollection, 
  useDoc, 
  useFirestore, 
  useAuth, 
  useUser, 
  useMemoFirebase,
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
  initiateEmailSignIn,
  initiateEmailSignUp
} from '@/firebase';
import { collection, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const BOUNSI_LAT = 24.8021;
const BOUNSI_LNG = 87.0267;
const MAX_DISTANCE_KM = 9;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  imageUrl: string;
  quantity: number;
}

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [isOrdersHistoryOpen, setIsOrdersHistoryOpen] = useState(false);
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [packagingType, setPackagingType] = useState<'Normal' | 'Gift'>('Normal');
  const [verificationCode, setVerificationCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'out_of_range'>('checking');

  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(BOUNSI_LAT, BOUNSI_LNG, pos.coords.latitude, pos.coords.longitude);
        if (dist <= MAX_DISTANCE_KM) setLocationStatus('allowed');
        else setLocationStatus('out_of_range');
      },
      () => setLocationStatus('denied')
    );
  }, []);

  const profileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const announcementRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'announcement'), [firestore]);
  const { data: announcement } = useDoc(announcementRef);

  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';
  const currentThemeConfig = THEME_DATA[currentTheme];

  const adminRoleRef = useMemoFirebase(() => user ? doc(firestore, 'admin_roles', user.uid) : null, [firestore, user]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isAdmin = !!adminRole;

  const userOrdersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'orders'), 
      where('userId', '==', user.uid), 
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, user]);
  const { data: userOrders } = useCollection(userOrdersQuery);

  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      setIsVerificationDialogOpen(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE && user) {
      setDocumentNonBlocking(doc(firestore, 'admin_roles', user.uid), { assignedAt: new Date().toISOString() }, { merge: true });
      setIsVerificationDialogOpen(false);
      setVerificationCode('');
      toast({ title: "Admin Access Granted" });
    } else {
      toast({ title: "Invalid Code", variant: "destructive" });
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) initiateEmailSignUp(auth, authEmail, authPassword);
    else initiateEmailSignIn(auth, authEmail, authPassword);
    setIsAuthDialogOpen(false);
    setAuthEmail('');
    setAuthPassword('');
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({ title: "Invalid Phone Number", variant: "destructive" });
      return;
    }
    if (user) {
      setDocumentNonBlocking(doc(firestore, 'userProfiles', user.uid), { phoneNumber, email: user.email || '' }, { merge: true });
      setIsPhoneDialogOpen(false);
      setIsPaymentDialogOpen(true);
      toast({ title: "Phone Verified" });
    }
  };

  const handleCancelOrder = (orderId: string) => {
    updateDocumentNonBlocking(doc(firestore, 'orders', orderId), { status: 'cancelled' });
    toast({ title: "Order Cancelled" });
  };

  const handleDeleteOrder = (orderId: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'orders', orderId));
    toast({ title: "Order Removed from History" });
  };

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products } = useCollection(productsQuery);

  const filteredProductsBySection = useMemo(() => {
    if (!products) return {};
    const filtered = products
      .filter(p => {
        const term = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(term) || 
          (p.section && p.section.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    
    return filtered.reduce((acc: any, p: any) => {
      const s = p.section || "General Bazaar";
      if (!acc[s]) acc[s] = [];
      acc[s].push(p);
      return acc;
    }, {});
  }, [products, searchQuery]);

  const addToCart = (product: any) => {
    if (!user) {
      setIsSignUp(true);
      setIsAuthDialogOpen(true);
      return;
    }
    setCart(prev => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          id: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          imageUrl: product.imageUrl,
          quantity: existing ? Math.min(existing.quantity + 1, 10) : 1
        }
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev[productId];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [productId]: { ...existing, quantity: existing.quantity - 1 }
      };
    });
  };

  const cartTotal = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const calculateFinalTotal = () => {
    const deliveryGST = cartTotal < 100 ? 125 : 25;
    const packagingFee = packagingType === 'Gift' ? 40 : 0;
    return cartTotal + deliveryGST + packagingFee;
  };

  const finalizeOrder = (method: 'COD' | 'UPI') => {
    const phone = profile?.phoneNumber || phoneNumber;
    const finalPrice = calculateFinalTotal();
    const itemsList = Object.values(cart).map(item => `• ${item.name} (${item.quantity} ${item.unit}) - ₹${item.price * item.quantity}`).join('\n');
    
    navigator.geolocation.getCurrentPosition((pos) => {
      const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      const message = `*BOUNSI BAZAAR ORDER*\n\n*Items:*\n${itemsList}\n\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingType}\n*Location:* ${locLink}\n*Phone:* ${phone}\n\n_Delivering in 30 mins!_ ⚡`;
      
      addDocumentNonBlocking(collection(firestore, 'orders'), {
        phoneNumber: phone,
        items: Object.values(cart),
        totalAmount: finalPrice,
        status: 'pending',
        userId: user?.uid,
        createdAt: new Date().toISOString()
      });

      window.open(`https://wa.me/${settings?.whatsappNumber || "917319965930"}?text=${encodeURIComponent(message)}`, '_blank');
      setIsQrDialogOpen(false);
      setIsPaymentDialogOpen(false);
      setCart({});
      toast({ title: "Order Placed Successfully!" });
    });
  };

  if (locationStatus === 'checking' || isUserLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-green-500" />
        <p className="font-bold text-slate-400 text-xs tracking-widest uppercase text-center">Opening Bazaar...</p>
      </div>
    );
  }

  if (locationStatus === 'out_of_range' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 text-center gap-6">
        <MapPin className="w-16 h-16 text-red-500" />
        <h1 className="text-3xl font-black text-slate-900 uppercase">Service Not Available</h1>
        <p className="text-slate-500 max-w-xs font-medium">We deliver within 9km of Bounsi (813104). Please enable location to browse.</p>
        <Button onClick={() => window.location.reload()} size="lg" className="rounded-full px-10 h-14 bg-black text-white font-bold">RETRY</Button>
      </div>
    );
  }

  // Mandatory Auth Check - Shows Blinkit-style landing
  if (!user) {
    return (
      <div className={cn("min-h-screen flex flex-col items-center justify-center p-6 text-center transition-all duration-500 bg-slate-50", currentThemeConfig.bg)}>
        <FestiveEffects theme={currentTheme} />
        <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-[2.5rem] shadow-2xl inline-block mb-2">
              <ShoppingBag className="w-14 h-14 text-green-500" />
            </div>
            <h1 className={cn("text-5xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>
              {currentThemeConfig.title}
            </h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Premium Groceries & Festive Essentials</p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-white/50 space-y-8">
            <div className="space-y-3">
              <h2 className="text-2xl font-black uppercase text-slate-900">Welcome to Bazaar</h2>
              <p className="text-xs font-medium text-slate-500">Sign in or create a new account to browse our collection and get delivered in 30 mins.</p>
            </div>

            <div className="grid gap-4">
              <Button onClick={() => { setIsSignUp(false); setIsAuthDialogOpen(true); }} className="h-16 rounded-[1.5rem] bg-black text-white font-black uppercase text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95 border-none">
                <LogIn className="w-5 h-5" /> Sign In to Account
              </Button>
              <Button onClick={() => { setIsSignUp(true); setIsAuthDialogOpen(true); }} variant="outline" className="h-16 rounded-[1.5rem] border-slate-200 text-slate-900 font-black uppercase text-sm hover:bg-slate-50 transition-all active:scale-95">
                <UserPlus className="w-5 h-5 mr-2" /> New Account
              </Button>
            </div>

            <div className="pt-6 flex items-center justify-center gap-8 opacity-60">
              <div className="flex flex-col items-center gap-1.5">
                <ShieldCheck className="w-6 h-6 text-green-600" />
                <span className="text-[9px] font-black uppercase">Secure</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Clock className="w-6 h-6 text-green-600" />
                <span className="text-[9px] font-black uppercase">30m Delivery</span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <MapPin className="w-6 h-6 text-green-600" />
                <span className="text-[9px] font-black uppercase">Bounsi 813104</span>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Dialog */}
        <Dialog open={isAuthDialogOpen} onOpenChange={setIsAuthDialogOpen}>
          <DialogContent className="rounded-[2.5rem] p-10 max-w-sm text-center border-none shadow-2xl">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black uppercase text-slate-900">{isSignUp ? 'Join Bazaar' : 'Welcome Back'}</DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase text-slate-400">
                {isSignUp ? 'Create account for exclusive bazaar deals' : 'Login to track your bazaar history'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                <div className="text-left"><Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Email Address</Label></div>
                <Input type="email" placeholder="example@email.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold px-5" required />
              </div>
              <div className="space-y-4">
                <div className="text-left"><Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Password</Label></div>
                <Input type="password" placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold px-5" required minLength={6} />
              </div>
              <Button type="submit" className="w-full h-14 rounded-2xl bg-green-500 text-white font-black uppercase text-sm border-none shadow-xl shadow-green-100 hover:bg-green-600">
                {isSignUp ? 'Create My Account' : 'Login Now'}
              </Button>
              <div className="pt-4">
                <button type="button" className="text-[10px] font-black uppercase text-green-600 hover:underline" onClick={() => setIsSignUp(!isSignUp)}>
                  {isSignUp ? 'Already have an account? Login' : "New to bazaar? Join Now"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Toaster />
      </div>
    );
  }

  // Main UI for Logged-in Users
  return (
    <div className={cn("min-h-screen relative pb-40 transition-colors duration-500", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className="sticky top-0 z-50 glass-nav">
        {announcement?.active && (
          <div className="bg-yellow-400 text-black py-2 px-4 text-center overflow-hidden">
            <p className="text-[10px] font-black uppercase flex items-center justify-center gap-2 animate-pulse">
              <Megaphone className="w-4 h-4" /> {announcement.message}
            </p>
          </div>
        )}
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <h1 className={cn("text-2xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>
              {currentThemeConfig.title}
            </h1>
            <div className="flex md:hidden items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsOrdersHistoryOpen(true)} className="rounded-xl h-10 w-10">
                <History className="w-5 h-5 text-green-600" />
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)} className="rounded-xl h-10 w-10 bg-blue-50">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="relative flex-1 w-full max-w-xl">
            <Search className="absolute left-4 top-4 text-slate-400 w-4 h-4" />
            <Input 
              placeholder="Search items, sections or categories..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full h-12 pl-12 rounded-2xl bg-slate-50 border-none shadow-inner text-sm font-bold placeholder:text-slate-400" 
            />
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setIsOrdersHistoryOpen(true)} className="rounded-2xl h-12 w-12 bg-white shadow-sm hover:shadow-md">
              <History className="w-6 h-6 text-green-600" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)} className="rounded-2xl h-12 w-12 bg-blue-50 hover:bg-blue-100">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="rounded-2xl h-12 w-12 text-slate-400 hover:text-red-500">
              <LogOut className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </nav>

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-white py-10 border-b animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="container mx-auto px-4 flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-blue-600 uppercase flex items-center gap-3">
              <Layers className="w-6 h-6" /> Administrator Hub
            </h2>
            <Button variant="outline" size="sm" onClick={() => signOut(auth)} className="rounded-xl text-blue-600 border-blue-100 hover:bg-red-50 hover:text-red-600">
              <LogOut className="w-4 h-4 mr-2" /> Exit Session
            </Button>
          </div>
          <AdminPanel currentTheme={currentTheme} isAdmin={isAdmin} />
        </div>
      )}

      <main className="container mx-auto px-4 py-10">
        <div className="space-y-16">
          {Object.entries(filteredProductsBySection).length > 0 ? (
            Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
              <section key={section} className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <LayoutGrid className="w-7 h-7 text-green-500" /> {section}
                  </h2>
                  <Badge variant="outline" className="rounded-full px-4 border-slate-100 text-slate-400 font-bold text-[10px] uppercase">{items.length} ITEMS</Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {items.map((p: any) => {
                    const cartItem = cart[p.id];
                    return (
                      <div key={p.id} className="group product-card-blinkit rounded-3xl p-4 flex flex-col h-full shadow-sm">
                        <div className="relative aspect-square mb-4 rounded-2xl overflow-hidden bg-slate-50">
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          {p.isPinned && (
                            <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 shadow-md">
                              <Pin className="w-3 h-3 fill-black" /> TOP PICK
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <h3 className="font-bold text-sm text-slate-800 line-clamp-2 uppercase leading-snug min-h-[2.5rem]">{p.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-none rounded-lg text-[9px] font-black uppercase">
                              {p.unit === 'kg' || p.unit === 'Liter' ? `1 ${p.unit}` : p.unit}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-5 flex items-center justify-between gap-3">
                          <span className="text-base font-black text-slate-900">₹{p.price}</span>
                          {cartItem ? (
                            <div className="flex items-center gap-2 bg-green-500 rounded-xl p-1 shadow-lg shadow-green-100 flex-1 justify-between">
                              <Button onClick={() => removeFromCart(p.id)} size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-lg border-none active:scale-90 transition-all">
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="text-white font-black text-sm">{cartItem.quantity}</span>
                              <Button onClick={() => addToCart(p)} size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-lg border-none active:scale-90 transition-all">
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button onClick={() => addToCart(p)} className="rounded-xl h-10 px-6 font-black text-xs bg-green-500 text-white hover:bg-green-600 uppercase shadow-lg shadow-green-100 border-none active:scale-95 transition-all">
                              ADD
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="py-32 text-center space-y-4">
              <div className="bg-slate-50 p-6 rounded-full inline-block">
                <Search className="w-16 h-16 text-slate-200 mx-auto" />
              </div>
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No matching products found in Bazaar</p>
            </div>
          )}
        </div>
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-lg z-[60] animate-in slide-in-from-bottom-10 duration-700">
          <div className="bg-green-600 text-white rounded-[2rem] p-5 flex items-center justify-between shadow-2xl border border-green-400">
            <div className="flex items-center gap-4">
              <div className="bg-green-700 p-3 rounded-2xl">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase leading-tight opacity-80">{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</p>
                <p className="text-xl font-black leading-tight">₹{cartTotal}</p>
              </div>
            </div>
            <Button onClick={() => {
              if (!profile?.phoneNumber) setIsPhoneDialogOpen(true);
              else setIsPaymentDialogOpen(true);
            }} className="bg-white text-green-700 hover:bg-slate-50 h-14 px-8 rounded-2xl font-black uppercase text-sm flex items-center gap-2 border-none active:scale-95 transition-all">
              GO TO CHECKOUT <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Orders History Dialog */}
      <Dialog open={isOrdersHistoryOpen} onOpenChange={setIsOrdersHistoryOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-lg border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3">
              <History className="w-6 h-6 text-green-600" /> My Bazaar History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
            {userOrders && userOrders.length > 0 ? (
              userOrders.map((order: any) => (
                <div key={order.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ID: #{order.id.slice(-6)}</p>
                      <p className="text-[11px] font-bold text-slate-500 uppercase">{new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <Badge className={cn(
                      "text-[9px] font-black uppercase rounded-lg border-none shadow-sm px-3 py-1",
                      order.status === 'pending' ? "bg-yellow-400 text-black" :
                      order.status === 'confirmed' ? "bg-blue-500 text-white" :
                      order.status === 'delivered' ? "bg-green-500 text-white" :
                      "bg-red-500 text-white"
                    )}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {order.items?.map((item: any, i: number) => (
                      <p key={i} className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                        <ArrowRight className="w-3 h-3 text-slate-300" /> {item.name} <span className="text-slate-400 text-[10px]">({item.quantity} {item.unit})</span>
                      </p>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200">
                    <span className="text-base font-black text-slate-900">₹{order.totalAmount}</span>
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <Button onClick={() => handleCancelOrder(order.id)} size="sm" variant="outline" className="h-10 rounded-xl text-red-600 border-red-100 hover:bg-red-50 text-[10px] font-black uppercase px-5">
                          <XCircle className="w-4 h-4 mr-2" /> Cancel
                        </Button>
                      )}
                      {(order.status === 'delivered' || order.status === 'cancelled') && (
                        <Button onClick={() => handleDeleteOrder(order.id)} size="sm" variant="ghost" className="h-10 rounded-xl text-slate-400 hover:text-red-500 text-[10px] font-black uppercase px-5">
                          <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center space-y-4">
                <ShoppingBag className="w-20 h-20 text-slate-100 mx-auto" />
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Your history is currently empty</p>
              </div>
            )}
          </div>
          <Button onClick={() => { signOut(auth); setIsOrdersHistoryOpen(false); }} variant="outline" className="w-full mt-6 h-14 rounded-2xl border-slate-100 text-slate-400 font-black uppercase text-xs hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all">
            <LogOut className="w-5 h-5 mr-3" /> Logout Account
          </Button>
        </DialogContent>
      </Dialog>

      {/* Checkout Summary Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-w-md border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">Review Bazaar Basket</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="max-h-[250px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {Object.values(cart).map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <img src={item.imageUrl} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                    <div>
                      <p className="text-[11px] font-black uppercase text-slate-800 line-clamp-1">{item.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{item.quantity} x {item.unit}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Select Packaging Style</Label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-4 rounded-2xl border text-left transition-all group", packagingType === 'Normal' ? "border-green-500 bg-green-50/50" : "border-slate-100")}>
                  <Package className={cn("w-5 h-5 mb-2", packagingType === 'Normal' ? "text-green-500" : "text-slate-300")} />
                  <p className="text-[11px] font-black uppercase">Normal (Free)</p>
                </button>
                <button onClick={() => setPackagingType('Gift')} className={cn("p-4 rounded-2xl border text-left transition-all group", packagingType === 'Gift' ? "border-pink-500 bg-pink-50/50" : "border-slate-100")}>
                  <Gift className={cn("w-5 h-5 mb-2", packagingType === 'Gift' ? "text-pink-500" : "text-slate-300")} />
                  <p className="text-[11px] font-black uppercase">Gift Wrap (+₹40)</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] p-6 space-y-3 border border-slate-100">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                <span>Basket Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                <span>Delivery & GST Fee</span>
                <span>₹{cartTotal < 100 ? 125 : 25}</span>
              </div>
              {packagingType === 'Gift' && (
                <div className="flex justify-between text-[11px] font-bold text-pink-500 uppercase">
                  <span>Special Packaging</span>
                  <span>₹40</span>
                </div>
              )}
              <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                <span className="text-lg font-black uppercase text-slate-900">Total to Pay</span>
                <span className="text-2xl font-black text-green-600">₹{calculateFinalTotal()}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-16 rounded-2xl bg-green-500 text-white font-black text-sm uppercase shadow-xl shadow-green-100 border-none hover:bg-green-600 active:scale-95 transition-all">
                <Smartphone className="w-5 h-5 mr-3" /> Pay via UPI Fast
              </Button>
              <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-16 rounded-2xl border-slate-100 text-slate-600 font-black text-sm uppercase hover:bg-slate-50 active:scale-95 transition-all">
                <Banknote className="w-5 h-5 mr-3" /> Cash on Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10 max-w-xs text-center border-none shadow-2xl">
          <h3 className="text-xl font-black uppercase mb-6">Scan QR for Payment</h3>
          <div className="p-6 bg-white rounded-[2rem] border-4 border-slate-50 shadow-inner mb-6">
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-full aspect-square object-contain" /> : <div className="w-full aspect-square bg-slate-100 flex items-center justify-center"><QrCode className="w-12 h-12 text-slate-300" /></div>}
          </div>
          <div className="space-y-1 mb-8">
            <p className="text-[10px] font-black text-slate-400 uppercase">Verified UPI ID</p>
            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{settings?.upiId || "N/A"}</p>
          </div>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-16 rounded-2xl bg-black text-white font-black uppercase text-sm border-none active:scale-95 transition-all shadow-xl">I've Completed Payment</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-sm text-center border-none shadow-2xl">
          <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black uppercase text-slate-900">Verify Contact</DialogTitle></DialogHeader>
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">10-Digit Mobile Number</Label>
              <Input 
                type="tel" 
                placeholder="9876543210" 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
                className="h-16 text-center text-xl font-black rounded-2xl border-slate-100 bg-slate-50 tracking-widest" 
              />
            </div>
            <Button type="submit" className="w-full h-16 rounded-2xl bg-green-500 text-white font-black uppercase text-sm border-none shadow-xl shadow-green-100">Continue to Checkout</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-xs text-center border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black uppercase text-blue-600">Admin Clearance</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-6 pt-4">
            <Input 
              maxLength={4} 
              className="text-center text-4xl h-20 font-black rounded-2xl border-slate-100 bg-slate-50 tracking-[0.5em] text-blue-600" 
              value={verificationCode} 
              onChange={(e) => setVerificationCode(e.target.value)} 
            />
            <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm border-none shadow-xl shadow-blue-100">Verify & Unlock Hub</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

