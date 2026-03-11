
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, Loader2, LayoutGrid, ShoppingCart, Megaphone, UserCircle, MessageSquareCode, Package, Gift, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, Bell, PhoneCall } from 'lucide-react';
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
  useMemoFirebase,
  addDocumentNonBlocking,
  setDocumentNonBlocking,
  useUser,
  useAuth,
  initiateAnonymousSignIn
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { generateOtp } from '@/ai/flows/send-otp-flow';

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
  const [isSmsVerifyDialogOpen, setIsSmsVerifyDialogOpen] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isForSomeoneElse, setIsForSomeoneElse] = useState(false);
  const [packagingType, setPackagingType] = useState<'Normal' | 'Gift'>('Normal');
  const [verificationCode, setVerificationCode] = useState('');
  const [smsVerifyCode, setSmsVerifyCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'out_of_range'>('allowed');

  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 
  const GIFT_CHARGE = 20;

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  useEffect(() => {
    if (!user) return;
    
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    setLocationStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(BOUNSI_LAT, BOUNSI_LNG, pos.coords.latitude, pos.coords.longitude);
        if (dist <= MAX_DISTANCE_KM) setLocationStatus('allowed');
        else setLocationStatus('out_of_range');
      },
      () => setLocationStatus('denied')
    );
  }, [user]);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const announcementRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'announcement'), [firestore]);
  const { data: announcement } = useDoc(announcementRef);

  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';
  const currentThemeConfig = THEME_DATA[currentTheme];

  // Admin status check from Firestore
  const adminRoleRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'admin_roles', user.uid);
  }, [user, firestore]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isActuallyAdmin = !!adminRole;

  // Search bar listener for admin secret key
  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      setIsVerificationDialogOpen(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE) {
      setIsVerificationDialogOpen(false);
      setVerificationCode('');
      
      if (user) {
        setDocumentNonBlocking(doc(firestore, 'admin_roles', user.uid), {
          assignedAt: new Date().toISOString()
        }, { merge: true });
        
        toast({ 
          title: "Promoting to Admin", 
          description: "Unlocking secure dashboard tools...",
          className: "bg-blue-600 text-white font-black"
        });
      }
    } else {
      toast({ title: "Invalid Code", variant: "destructive" });
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({ title: "Valid 10-Digit Phone Required", variant: "destructive" });
      return;
    }
    if (!deliveryAddress) {
      toast({ title: "Address Required", description: "Please enter a delivery address", variant: "destructive" });
      return;
    }
    if (isForSomeoneElse && (!recipientPhone || recipientPhone.length < 10)) {
      toast({ title: "Recipient Details Missing", description: "Fill 10-digit recipient number", variant: "destructive" });
      return;
    }

    setIsOtpLoading(true);
    try {
      const result = await generateOtp({ phoneNumber });
      setGeneratedOtp(result.code);
      
      setIsPhoneDialogOpen(false);
      setIsSmsVerifyDialogOpen(true);
      
      toast({ 
        title: `Verification Sent`, 
        description: `Sender: bounsibazaar.com code. Code: ${result.code}`,
        duration: 10000 
      });
    } catch (err) {
      toast({ title: "Failed to generate verification", variant: "destructive" });
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleSmsVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (smsVerifyCode === generatedOtp) {
      setIsSmsVerifyDialogOpen(false);
      setIsPaymentDialogOpen(true);
      setSmsVerifyCode('');
      toast({ title: "Identity Verified", className: "bg-green-600 text-white" });
    } else {
      toast({ title: "Invalid OTP", variant: "destructive" });
    }
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

  const finalizeOrder = (method: 'COD' | 'UPI') => {
    if (!user) return;
    const finalPrice = cartTotal + (cartTotal < 100 ? 125 : 25) + (packagingType === 'Gift' ? GIFT_CHARGE : 0);
    const itemsList = Object.values(cart).map(item => `• ${item.name} (${item.quantity} ${item.unit})`).join('\n');
    
    const sendOrder = (locationData: string) => {
      let message = `*BOUNSI BAZAAR ORDER*\n\n*Items:*\n${itemsList}\n\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingType}\n\n`;
      message += `*Delivery Address:* ${deliveryAddress}\n`;
      if (isForSomeoneElse) {
        message += `*ORDER FOR SOMEONE ELSE*\n*Sender:* ${phoneNumber}\n*Recipient:* ${recipientPhone}\n\n`;
      } else {
        message += `*Phone:* ${phoneNumber}\n\n`;
      }
      message += `*Map Location:* ${locationData}\n\n`;
      message += `_Fast Delivery (30 min)!_ ⚡`;
      
      addDocumentNonBlocking(collection(firestore, 'orders'), {
        userId: user.uid,
        phoneNumber: phoneNumber,
        senderPhone: isForSomeoneElse ? phoneNumber : null,
        recipientPhone: isForSomeoneElse ? recipientPhone : null,
        deliveryAddress: deliveryAddress,
        isForSomeoneElse: isForSomeoneElse,
        items: Object.values(cart),
        totalAmount: finalPrice,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      window.open(`https://wa.me/${settings?.whatsappNumber || "917319965930"}?text=${encodeURIComponent(message)}`, '_blank');
      setIsQrDialogOpen(false);
      setIsPaymentDialogOpen(false);
      setCart({});
      toast({ title: "Order Placed Successfully!", className: "bg-green-600 text-white" });
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        sendOrder(locLink);
      },
      () => sendOrder("Location not allowed")
    );
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-green-500 mb-6" />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] animate-pulse">Bazaar Loading...</p>
      </div>
    );
  }

  if (locationStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-6">
        <Loader2 className="w-12 h-12 animate-spin text-green-500" />
        <p className="font-black text-slate-400 text-[10px] tracking-[0.3em] uppercase">Locating your area...</p>
      </div>
    );
  }

  if (locationStatus === 'out_of_range' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 text-center gap-10">
        <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center shadow-xl shadow-red-50">
          <LayoutGrid className="w-10 h-10 text-red-500" />
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-black text-slate-900 uppercase italic">Out of Range</h1>
          <p className="text-slate-500 max-w-xs font-bold leading-relaxed text-sm">We deliver within 9km of Bounsi (813104). Please enable location access.</p>
        </div>
        <Button onClick={() => window.location.reload()} size="lg" className="rounded-full px-10 h-14 bg-black text-white font-black text-xs uppercase shadow-2xl active:scale-95 transition-all">RETRY ACCESS</Button>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-40 transition-colors duration-700", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <header className="relative z-[60]">
        <div className="bg-yellow-400 text-black py-3 px-4 text-center border-b-2 border-black shadow-md">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <Megaphone className="w-4 h-4 md:w-5 md:h-5 animate-bounce shrink-0" />
            <p className="text-[10px] md:text-sm font-black uppercase tracking-tight italic">
              Welcome to Bounsi Bazaar 🔺🍥🍤🌴💐
              {announcement?.active && ` — ${announcement.message}`}
            </p>
          </div>
        </div>

        <nav className="sticky top-0 glass-nav py-4 shadow-sm">
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <h1 className={cn("text-2xl md:text-3xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r drop-shadow-sm", currentThemeConfig.gradient)}>
                {currentThemeConfig.title}
              </h1>
            </div>
            
            <div className="relative flex-1 w-full max-w-2xl flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-4 text-slate-400 w-4 h-4" />
                <Input 
                  placeholder="Search products..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full h-12 pl-11 rounded-xl bg-white border-none shadow-sm text-sm font-bold placeholder:text-slate-400" 
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="relative p-2 text-slate-400 hover:text-primary">
                  <Bell className="w-6 h-6" />
                  {announcement?.active && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white notification-pulse" />}
                </Button>
                {/* Admin button only visible for verified admins */}
                {isActuallyAdmin && (
                  <Button 
                    onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)}
                    className={cn("h-12 w-12 rounded-xl shadow-md border-none transition-all", isAdminPanelVisible ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600")}
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Admin Panel is strictly guarded by isActuallyAdmin */}
      {isActuallyAdmin && isAdminPanelVisible && (
        <div className="bg-white/70 backdrop-blur-3xl py-8 md:py-12 border-b border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
          <AdminPanel currentTheme={currentTheme} isAdmin={isActuallyAdmin} />
        </div>
      )}

      <main className="container mx-auto px-4 py-8 md:py-16">
        <div className="space-y-12 md:space-y-24">
          {Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
            <section key={section} className="space-y-6 md:space-y-10">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-50 rounded-xl shadow-sm">
                    <LayoutGrid className="w-6 h-6 text-green-500" />
                  </div>
                  <h2 className="text-xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 italic">{section}</h2>
                </div>
                <Badge variant="outline" className="rounded-full px-4 py-1.5 border-slate-200 text-slate-400 font-black text-[9px] uppercase tracking-widest bg-white">{items.length} ITEMS</Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-8">
                {items.map((p: any) => {
                  const cartItem = cart[p.id];
                  return (
                    <div key={p.id} className="group product-card-premium rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-5 flex flex-col h-full animate-in fade-in duration-500">
                      <div className="relative aspect-square mb-3 md:mb-6 rounded-xl md:rounded-[2rem] overflow-hidden bg-slate-50 border border-white shadow-inner">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        {p.isPinned && (
                          <div className="absolute top-2 left-2 md:top-4 md:left-4 bg-yellow-400 text-black px-2 py-1 rounded-lg md:rounded-2xl text-[8px] md:text-[10px] font-black flex items-center gap-1.5 shadow-lg">
                            <Pin className="w-3 h-3 fill-black" /> BEST
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="font-bold text-sm md:text-base text-slate-800 line-clamp-2 uppercase min-h-[2.5rem] md:min-h-[3rem] leading-tight">{p.name}</h3>
                        <Badge className="bg-slate-100 text-slate-500 border-none rounded-lg text-[8px] md:text-[10px] font-black uppercase px-2 py-0.5">
                          {p.unit === 'kg' || p.unit === 'Liter' ? `1 ${p.unit}` : p.unit}
                        </Badge>
                      </div>
                      <div className="mt-4 md:mt-8 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase leading-none mb-1">Price</span>
                          <span className="text-lg md:text-xl font-black text-slate-900 leading-none">₹{p.price}</span>
                        </div>
                        {cartItem ? (
                          <div className="flex items-center gap-2 bg-green-500 rounded-xl p-0.5 md:p-1 flex-1 justify-between shadow-lg">
                            <Button onClick={() => removeFromCart(p.id)} size="icon" className="h-8 w-8 md:h-10 md:w-10 bg-green-600 text-white rounded-lg active:scale-90">
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="text-white font-black text-sm md:text-base">{cartItem.quantity}</span>
                            <Button onClick={() => addToCart(p)} size="icon" className="h-8 w-8 md:h-10 md:w-10 bg-green-600 text-white rounded-lg active:scale-90">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => addToCart(p)} className="rounded-xl h-10 md:h-14 px-4 md:px-8 font-black text-xs md:text-sm bg-green-500 text-white hover:bg-green-600 uppercase shadow-md active:scale-95 transition-all">
                            ADD
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-6 md:bottom-12 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-[70] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-green-600 text-white rounded-3xl md:rounded-[3rem] p-4 md:p-6 flex items-center justify-between shadow-2xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="bg-white/20 p-3 md:p-4 rounded-2xl backdrop-blur-md">
                <ShoppingCart className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div>
                <p className="text-[9px] md:text-[11px] font-black uppercase leading-tight opacity-70 tracking-widest">{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</p>
                <p className="text-xl md:text-3xl font-black leading-tight tracking-tighter italic">₹{cartTotal}</p>
              </div>
            </div>
            <Button onClick={() => setIsPhoneDialogOpen(true)} className="bg-white text-green-700 hover:bg-slate-50 h-12 md:h-16 px-6 md:px-10 rounded-2xl md:rounded-[1.5rem] font-black uppercase text-xs md:text-sm flex items-center gap-2 active:scale-95 transition-all">
              PROCEED <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      <Toaster />

      {/* Verification Dialog for Secret Hub Key */}
      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-3xl p-8 md:p-12 max-w-xs text-center bg-white border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl md:text-2xl font-black uppercase italic text-blue-600 tracking-tighter">Admin Hub Activation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-blue-300 tracking-widest">Verification Key</Label>
              <Input 
                type="password"
                maxLength={4} 
                className="text-center text-4xl h-16 md:h-20 font-black rounded-2xl border-2 border-blue-50 bg-white tracking-[0.5em] text-blue-600 focus:border-blue-500 shadow-inner" 
                value={verificationCode} 
                onChange={(e) => setVerificationCode(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full h-14 md:h-16 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs md:text-sm border-none shadow-lg active:scale-95 transition-all">Unlock Tools</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialogs */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 max-w-xl bg-white border-none">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-900 italic">Checkout Summary</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Delivery Experience</Label>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-4 md:p-6 rounded-2xl border-2 text-left transition-all", packagingType === 'Normal' ? "border-green-500 bg-green-50" : "border-slate-100")}>
                  <Package className={cn("w-6 h-6 md:w-8 md:h-8 mb-3", packagingType === 'Normal' ? "text-green-500" : "text-slate-200")} />
                  <p className="text-[10px] md:text-[12px] font-black uppercase text-slate-900 leading-tight">Standard</p>
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase mt-1">Included</p>
                </button>
                <button onClick={() => setPackagingType('Gift')} className={cn("p-4 md:p-6 rounded-2xl border-2 text-left transition-all", packagingType === 'Gift' ? "border-pink-500 bg-pink-50" : "border-slate-100")}>
                  <Gift className={cn("w-6 h-6 md:w-8 md:h-8 mb-3", packagingType === 'Gift' ? "text-pink-500" : "text-slate-200")} />
                  <p className="text-[10px] md:text-[12px] font-black uppercase text-slate-900 leading-tight">Gift Wrap</p>
                  <p className="text-[8px] md:text-[10px] font-bold text-pink-500 uppercase mt-1">+₹{GIFT_CHARGE}</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 md:p-8 space-y-4 text-white">
              <div className="space-y-3 pb-4 border-b border-white/10 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                <Label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Items & Prices</Label>
                {Object.values(cart).map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-[10px] md:text-[12px]">
                    <span className="font-black uppercase truncate max-w-[150px]">{item.quantity}x {item.name}</span>
                    <span className="font-black italic">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <span>Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>
              <div className="flex justify-between text-[9px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <span>Fast Delivery</span>
                <span>₹{cartTotal < 100 ? 125 : 25}</span>
              </div>
              {packagingType === 'Gift' && (
                <div className="flex justify-between text-[9px] md:text-[11px] font-black text-pink-400 uppercase tracking-widest">
                  <span>Gift Charge</span>
                  <span>₹{GIFT_CHARGE}</span>
                </div>
              )}
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-lg md:text-xl font-black uppercase italic tracking-tighter">Grand Total</span>
                <span className="text-3xl md:text-4xl font-black text-green-400 italic">₹{cartTotal + (cartTotal < 100 ? 125 : 25) + (packagingType === 'Gift' ? GIFT_CHARGE : 0)}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-16 md:h-20 rounded-2xl bg-green-500 text-white font-black text-sm md:text-base uppercase shadow-lg border-none active:scale-95 transition-all">
                <Smartphone className="w-5 h-5 md:w-6 md:h-6 mr-3" /> UPI Payment
              </Button>
              <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-16 md:h-20 rounded-2xl border-2 border-slate-100 text-slate-600 font-black text-sm md:text-base uppercase active:scale-95 transition-all">
                <Banknote className="w-5 h-5 md:w-6 md:h-6 mr-3" /> Cash on Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-sm text-center bg-white border-none shadow-2xl">
          <h3 className="text-xl md:text-2xl font-black uppercase italic mb-6 tracking-tighter">Scan to Pay</h3>
          <div className="p-6 bg-slate-50 rounded-3xl border-2 border-white shadow-inner mb-6">
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-full aspect-square object-contain" /> : <div className="w-full aspect-square flex items-center justify-center bg-white rounded-2xl"><QrCode className="w-16 h-16 text-slate-200" /></div>}
          </div>
          <div className="bg-green-50 p-3 rounded-xl mb-8 border border-green-100">
            <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">UPI ID</p>
            <p className="text-sm font-black text-slate-900">{settings?.upiId || "NOT_SET@UPI"}</p>
          </div>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-16 rounded-2xl bg-black text-white font-black uppercase text-sm border-none active:scale-95 transition-all shadow-xl">Payment Done</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-3xl p-6 md:p-12 max-w-md text-center bg-white border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 tracking-tighter">Delivery Info</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-center gap-4 md:gap-6 mb-8 bg-slate-50 p-4 md:p-6 rounded-2xl">
            <UserCircle className={cn("w-6 h-6 transition-colors", !isForSomeoneElse ? "text-green-500" : "text-slate-300")} />
            <Switch checked={isForSomeoneElse} onCheckedChange={setIsForSomeoneElse} />
            <Gift className={cn("w-6 h-6 transition-colors", isForSomeoneElse ? "text-pink-500" : "text-slate-300")} />
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Gifting?</span>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-6 md:space-y-8 text-left">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-4">Phone Number</Label>
              <Input 
                type="tel" 
                placeholder="10 Digits" 
                maxLength={10} 
                value={phoneNumber} 
                onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setPhoneNumber(val); }} 
                className="h-16 md:h-20 text-center text-2xl md:text-3xl font-black rounded-2xl border-2 border-slate-100 bg-white tracking-[0.2em] focus:border-green-500" 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-4">Address</Label>
              <Textarea placeholder="Enter full address..." value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="rounded-2xl border-2 border-slate-100 bg-white font-bold h-24 md:h-32 p-4 md:p-6 text-sm md:text-base focus:border-green-500" />
            </div>

            {isForSomeoneElse && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-4">Recipient's Phone</Label>
                <Input type="tel" placeholder="10 Digits" maxLength={10} value={recipientPhone} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setRecipientPhone(val); }} className="h-14 md:h-16 text-center text-lg md:text-xl font-black rounded-2xl border-2 border-pink-100 bg-white tracking-widest focus:border-pink-500" />
              </div>
            )}

            <Button type="submit" disabled={isOtpLoading} className="w-full h-16 md:h-20 rounded-2xl bg-green-500 text-white font-black uppercase text-sm md:text-base border-none shadow-xl active:scale-95 transition-all">
              {isOtpLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify Identity"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSmsVerifyDialogOpen} onOpenChange={setIsSmsVerifyDialogOpen}>
        <DialogContent className="rounded-3xl p-8 md:p-12 max-sm:w-full text-center bg-white border-none shadow-2xl">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-xl md:text-2xl font-black uppercase italic text-slate-900 flex items-center justify-center gap-3 tracking-tighter">
              <MessageSquareCode className="w-6 h-6 md:w-8 md:h-8 text-green-500" /> OTP Verification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.3em]">Enter code from bounsibazaar.com</p>
              <form onSubmit={handleSmsVerifyCode} className="space-y-8">
                <Input maxLength={4} placeholder="••••" className="text-center text-4xl h-16 md:h-20 font-black rounded-2xl border-2 border-slate-50 bg-white tracking-[0.5em] focus:border-green-500" value={smsVerifyCode} onChange={(e) => setSmsVerifyCode(e.target.value)} />
                <Button type="submit" className="w-full h-16 md:h-20 rounded-2xl bg-green-500 text-white font-black uppercase text-sm md:text-base border-none shadow-xl active:scale-95 transition-all">Verify & Pay</Button>
              </form>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-2">DEMO CODE</p>
              <p className="text-base md:text-lg font-black text-green-600 tracking-[0.4em]">{generatedOtp}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
