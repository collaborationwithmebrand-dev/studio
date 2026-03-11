"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, Loader2, LayoutGrid, ShoppingCart, Megaphone, UserCircle, MessageSquareCode, Package, Gift, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, PhoneCall, ArrowLeft } from 'lucide-react';
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
const MIN_ORDER_AMOUNT = 100;

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

  const adminRoleRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'admin_roles', user.uid);
  }, [user, firestore]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isActuallyAdmin = !!adminRole;

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
    <div className={cn("min-h-screen relative pb-40 transition-all duration-1000 ease-in-out", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <header className="relative z-[60]">
        <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 text-black py-3 px-4 text-center border-b-2 border-black/10 shadow-lg">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <Megaphone className="w-4 h-4 md:w-5 md:h-5 animate-bounce shrink-0" />
            <p className="text-[10px] md:text-sm font-black uppercase tracking-tight italic">
              Welcome to Bounsi Bazaar 🔺🍥🍤🌴💐
              {announcement?.active && ` — ${announcement.message}`}
            </p>
          </div>
        </div>

        <nav className="sticky top-0 glass-nav py-4 shadow-xl z-50">
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full md:w-auto gap-4">
              <h1 className={cn("text-2xl md:text-4xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r drop-shadow-2xl transition-all duration-500", currentThemeConfig.gradient)}>
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
                  className="w-full h-12 pl-11 rounded-2xl bg-white border-none shadow-inner text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 transition-all" 
                />
              </div>
              <div className="flex items-center gap-2">
                {isActuallyAdmin && (
                  <Button 
                    onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)}
                    className={cn("h-12 w-12 rounded-2xl shadow-xl border-none transition-all active:scale-90", isAdminPanelVisible ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600")}
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      {isActuallyAdmin && isAdminPanelVisible && (
        <div className="bg-white/40 backdrop-blur-3xl py-10 border-b border-slate-100/50 animate-in fade-in slide-in-from-top-10 duration-700">
          <AdminPanel currentTheme={currentTheme} isAdmin={isActuallyAdmin} />
        </div>
      )}

      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="space-y-16 md:space-y-32">
          {Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
            <section key={section} className="space-y-8 md:space-y-12">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <LayoutGrid className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 italic leading-none">{section}</h2>
                </div>
                <Badge variant="outline" className="rounded-full px-6 py-2 border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] bg-white/50 backdrop-blur-sm">{items.length} ITEMS</Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 md:gap-10">
                {items.map((p: any) => {
                  const cartItem = cart[p.id];
                  return (
                    <div key={p.id} className="group product-card-premium rounded-[2.5rem] p-4 md:p-6 flex flex-col h-full animate-in fade-in duration-700 scale-in-95">
                      <div className="relative aspect-square mb-4 md:mb-8 rounded-[2rem] overflow-hidden bg-slate-50 border border-white shadow-inner">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        {p.isPinned && (
                          <div className="absolute top-3 left-3 md:top-5 md:left-5 bg-yellow-400 text-black px-3 py-1.5 rounded-2xl text-[9px] md:text-[11px] font-black flex items-center gap-2 shadow-2xl border-2 border-white/20">
                            <Pin className="w-3.5 h-3.5 fill-black" /> BEST
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <h3 className="font-bold text-sm md:text-lg text-slate-800 line-clamp-2 uppercase min-h-[3rem] md:min-h-[4rem] leading-tight tracking-tight">{p.name}</h3>
                        <Badge className="bg-slate-100 text-slate-500 border-none rounded-xl text-[9px] md:text-[11px] font-black uppercase px-3 py-1">
                          {p.unit === 'kg' || p.unit === 'Liter' ? `1 ${p.unit}` : p.unit}
                        </Badge>
                      </div>
                      <div className="mt-6 md:mt-10 flex flex-col gap-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] md:text-[11px] font-black text-slate-300 uppercase leading-none mb-1.5 tracking-wider">Net Price</span>
                          <span className="text-xl md:text-2xl font-black text-slate-900 leading-none italic">₹{p.price}</span>
                        </div>
                        {cartItem ? (
                          <div className="flex items-center gap-3 bg-primary rounded-2xl p-1.5 flex-1 justify-between shadow-2xl border border-white/20">
                            <Button onClick={() => removeFromCart(p.id)} size="icon" className="h-10 w-10 bg-black/10 text-white rounded-xl active:scale-90 hover:bg-black/20 transition-all border-none">
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="text-white font-black text-lg">{cartItem.quantity}</span>
                            <Button onClick={() => addToCart(p)} size="icon" className="h-10 w-10 bg-black/10 text-white rounded-xl active:scale-90 hover:bg-black/20 transition-all border-none">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => addToCart(p)} className="rounded-2xl h-14 md:h-16 px-6 md:px-10 font-black text-xs md:text-sm bg-primary text-white hover:brightness-110 uppercase shadow-2xl active:scale-95 transition-all border-none tracking-widest">
                            ADD TO BASKET
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
        <div className="fixed bottom-8 md:bottom-16 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-2xl z-[70] animate-in slide-in-from-bottom-20 duration-700">
          <div className="bg-slate-900/90 text-white rounded-[3rem] p-5 md:p-8 flex items-center justify-between shadow-[0_30px_100px_rgba(0,0,0,0.4)] border border-white/10 backdrop-blur-2xl">
            <div className="flex items-center gap-5 md:gap-8">
              <div className="bg-primary p-4 md:p-6 rounded-[1.5rem] shadow-2xl shadow-primary/20">
                <ShoppingCart className="w-7 h-7 md:w-9 md:h-9 text-white" />
              </div>
              <div>
                <p className="text-[10px] md:text-[12px] font-black uppercase leading-tight opacity-50 tracking-[0.3em] mb-1">{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</p>
                <p className="text-2xl md:text-4xl font-black leading-tight tracking-tighter italic text-green-400">₹{cartTotal}</p>
                {cartTotal < MIN_ORDER_AMOUNT && (
                  <p className="text-[8px] md:text-[10px] font-bold text-yellow-300 uppercase animate-pulse mt-1 tracking-widest">ADD ₹{MIN_ORDER_AMOUNT - cartTotal} MORE FOR MINIMUM ORDER</p>
                )}
              </div>
            </div>
            <Button 
              onClick={() => {
                if (cartTotal < MIN_ORDER_AMOUNT) {
                  toast({ 
                    title: "Minimum Order ₹100", 
                    description: `Add ₹${MIN_ORDER_AMOUNT - cartTotal} more to your basket to proceed.`,
                    variant: "destructive"
                  });
                  return;
                }
                setIsPhoneDialogOpen(true);
              }} 
              className="bg-primary text-white hover:brightness-110 h-14 md:h-20 px-8 md:px-14 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-xs md:text-base flex items-center gap-3 active:scale-95 transition-all border-none shadow-2xl shadow-primary/30"
            >
              PROCEED <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      )}

      <Toaster />

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10 md:p-16 max-w-md text-center bg-white border-none shadow-[0_50px_100px_rgba(0,0,0,0.1)]">
          <DialogHeader className="mb-10">
            <DialogTitle className="text-2xl md:text-3xl font-black uppercase italic text-blue-600 tracking-tighter leading-none">Admin Hub Unlock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-10">
            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase text-slate-300 tracking-[0.4em]">Verification Key</Label>
              <Input 
                type="password"
                maxLength={4} 
                className="text-center text-5xl h-20 md:h-28 font-black rounded-3xl border-4 border-slate-50 bg-slate-50/50 tracking-[0.6em] text-blue-600 focus:border-blue-500 shadow-inner transition-all" 
                value={verificationCode} 
                onChange={(e) => setVerificationCode(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full h-16 md:h-20 rounded-3xl bg-blue-600 text-white font-black uppercase text-sm md:text-lg border-none shadow-2xl hover:bg-blue-700 active:scale-95 transition-all">Authenticate Tools</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[3.5rem] p-8 md:p-14 max-w-2xl bg-white border-none shadow-2xl overflow-hidden">
          <Button variant="ghost" onClick={() => { setIsPaymentDialogOpen(false); setIsSmsVerifyDialogOpen(true); }} className="absolute left-6 top-6 h-12 w-12 p-0 rounded-2xl text-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <DialogHeader className="mb-10 mt-6">
            <DialogTitle className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 italic leading-none">Order Summary</DialogTitle>
          </DialogHeader>

          <div className="space-y-10">
            <div className="space-y-6">
              <Label className="text-[11px] font-black uppercase text-slate-400 ml-6 tracking-[0.4em]">Packaging Style</Label>
              <div className="grid grid-cols-2 gap-6">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-6 md:p-10 rounded-[2.5rem] border-4 text-left transition-all duration-500", packagingType === 'Normal' ? "border-primary bg-primary/5 shadow-2xl" : "border-slate-50 hover:border-slate-100")}>
                  <Package className={cn("w-8 h-8 md:w-12 md:h-12 mb-5", packagingType === 'Normal' ? "text-primary" : "text-slate-200")} />
                  <p className="text-xs md:text-sm font-black uppercase text-slate-900 leading-tight">Standard</p>
                  <p className="text-[9px] md:text-[11px] font-bold text-slate-400 uppercase mt-2">Bazaar Box</p>
                </button>
                <button onClick={() => setPackagingType('Gift')} className={cn("p-6 md:p-10 rounded-[2.5rem] border-4 text-left transition-all duration-500", packagingType === 'Gift' ? "border-pink-500 bg-pink-50 shadow-2xl" : "border-slate-50 hover:border-slate-100")}>
                  <Gift className={cn("w-8 h-8 md:w-12 md:h-12 mb-5", packagingType === 'Gift' ? "text-pink-500" : "text-slate-200")} />
                  <p className="text-xs md:text-sm font-black uppercase text-slate-900 leading-tight">Premium Gift</p>
                  <p className="text-[9px] md:text-[11px] font-bold text-pink-500 uppercase mt-2">+₹{GIFT_CHARGE}</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-[3rem] p-8 md:p-12 space-y-6 text-white shadow-2xl">
              <div className="space-y-4 pb-6 border-b border-white/5 max-h-[200px] overflow-y-auto custom-scrollbar pr-4">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Itemized Receipt</Label>
                {Object.values(cart).map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs md:text-sm">
                    <span className="font-black uppercase truncate max-w-[200px] text-slate-200">{item.quantity}x {item.name}</span>
                    <span className="font-black italic text-slate-400">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Cart Subtotal</span>
                  <span className="text-slate-300">₹{cartTotal}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Priority Delivery</span>
                  <span className="text-slate-300">₹{cartTotal < 100 ? 125 : 25}</span>
                </div>
                {packagingType === 'Gift' && (
                  <div className="flex justify-between text-[11px] font-black text-pink-400 uppercase tracking-widest">
                    <span>Gift Wrap Charge</span>
                    <span>₹{GIFT_CHARGE}</span>
                  </div>
                )}
              </div>
              
              <div className="pt-8 border-t border-white/10 flex justify-between items-center">
                <span className="text-2xl font-black uppercase italic tracking-tighter leading-none">Grand Total</span>
                <span className="text-4xl md:text-6xl font-black text-primary italic leading-none shadow-primary/20">₹{cartTotal + (cartTotal < 100 ? 125 : 25) + (packagingType === 'Gift' ? GIFT_CHARGE : 0)}</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col md:flex-row gap-6">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-20 md:h-24 flex-1 rounded-[2rem] bg-primary text-white font-black text-sm md:text-lg uppercase shadow-2xl border-none hover:brightness-110 active:scale-95 transition-all">
                <Smartphone className="w-6 h-6 md:w-8 md:h-8 mr-4" /> UPI SECURE
              </Button>
              <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-20 md:h-24 flex-1 rounded-[2rem] border-4 border-slate-50 text-slate-500 font-black text-sm md:text-lg uppercase hover:bg-slate-50 active:scale-95 transition-all">
                <Banknote className="w-6 h-6 md:w-8 md:h-8 mr-4" /> PAY ON DELIVERY
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10 max-w-md text-center bg-white border-none shadow-2xl">
          <Button variant="ghost" onClick={() => { setIsQrDialogOpen(false); setIsPaymentDialogOpen(true); }} className="absolute left-6 top-6 h-12 w-12 p-0 rounded-2xl text-slate-300">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h3 className="text-2xl md:text-4xl font-black uppercase italic mb-10 mt-8 tracking-tighter leading-none">Scan to Pay</h3>
          <div className="p-8 bg-slate-50 rounded-[3rem] border-4 border-white shadow-inner mb-10 relative group">
            <div className="absolute inset-0 shimmer opacity-10 pointer-events-none" />
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-full aspect-square object-contain rounded-2xl" /> : <div className="w-full aspect-square flex items-center justify-center bg-white rounded-[2rem]"><QrCode className="w-20 h-20 text-slate-100" /></div>}
          </div>
          <div className="bg-primary/5 p-5 rounded-2xl mb-12 border border-primary/10">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2">Merchant UPI ID</p>
            <p className="text-lg font-black text-slate-900 tracking-tight">{settings?.upiId || "NOT_SET@UPI"}</p>
          </div>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-20 rounded-3xl bg-slate-950 text-white font-black uppercase text-sm md:text-lg border-none active:scale-95 transition-all shadow-[0_20px_60px_rgba(0,0,0,0.3)]">CONFIRM PAYMENT</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[3.5rem] p-10 md:p-16 max-md:max-w-[95%] text-center bg-white border-none shadow-2xl">
          <Button variant="ghost" onClick={() => setIsPhoneDialogOpen(false)} className="absolute left-6 top-6 h-12 w-12 p-0 rounded-2xl text-slate-300">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <DialogHeader className="mb-12 mt-6">
            <DialogTitle className="text-3xl md:text-5xl font-black uppercase italic text-slate-900 tracking-tighter leading-none">Delivery Details</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-center gap-6 md:gap-10 mb-12 bg-slate-50 p-6 md:p-10 rounded-[2.5rem] border border-slate-100">
            <div className="flex flex-col items-center gap-3">
              <div className={cn("p-4 rounded-2xl transition-all duration-500 shadow-xl", !isForSomeoneElse ? "bg-primary text-white scale-110" : "bg-white text-slate-200")}>
                <UserCircle className="w-7 h-7" />
              </div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Self</span>
            </div>
            <Switch checked={isForSomeoneElse} onCheckedChange={setIsForSomeoneElse} className="scale-150 data-[state=checked]:bg-pink-500" />
            <div className="flex flex-col items-center gap-3">
              <div className={cn("p-4 rounded-2xl transition-all duration-500 shadow-xl", isForSomeoneElse ? "bg-pink-500 text-white scale-110" : "bg-white text-slate-200")}>
                <Gift className="w-7 h-7" />
              </div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Gift</span>
            </div>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-8 md:space-y-12 text-left">
            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase text-slate-300 ml-6 tracking-[0.3em]">Mobile Number</Label>
              <Input 
                type="tel" 
                placeholder="00000 00000" 
                maxLength={10} 
                value={phoneNumber} 
                onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setPhoneNumber(val); }} 
                className="h-20 md:h-28 text-center text-3xl md:text-5xl font-black rounded-[2rem] border-4 border-slate-50 bg-slate-50/50 tracking-[0.3em] focus:border-primary transition-all shadow-inner" 
              />
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase text-slate-300 ml-6 tracking-[0.3em]">Drop Location</Label>
              <Textarea placeholder="Building, Street, Landmark..." value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="rounded-[2rem] border-4 border-slate-50 bg-slate-50/50 font-bold h-32 md:h-44 p-6 md:p-10 text-sm md:text-xl focus:border-primary transition-all shadow-inner placeholder:text-slate-200" />
            </div>

            {isForSomeoneElse && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <Label className="text-[11px] font-black uppercase text-pink-300 ml-6 tracking-[0.3em]">Recipient's Phone</Label>
                <Input type="tel" placeholder="10 Digit Number" maxLength={10} value={recipientPhone} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setRecipientPhone(val); }} className="h-20 md:h-24 text-center text-2xl md:text-3xl font-black rounded-[2rem] border-4 border-pink-50 bg-pink-50/30 tracking-[0.2em] focus:border-pink-500 shadow-inner" />
              </div>
            )}

            <Button type="submit" disabled={isOtpLoading} className="w-full h-20 md:h-28 rounded-[2.5rem] bg-slate-950 text-white font-black uppercase text-sm md:text-2xl border-none shadow-[0_30px_60px_rgba(0,0,0,0.3)] active:scale-95 transition-all">
              {isOtpLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : "VERIFY IDENTITY"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSmsVerifyDialogOpen} onOpenChange={setIsSmsVerifyDialogOpen}>
        <DialogContent className="rounded-[3.5rem] p-10 md:p-20 max-sm:w-full text-center bg-white border-none shadow-2xl">
          <Button variant="ghost" onClick={() => { setIsSmsVerifyDialogOpen(false); setIsPhoneDialogOpen(true); }} className="absolute left-6 top-6 h-12 w-12 p-0 rounded-2xl text-slate-300">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <DialogHeader className="mb-12 mt-6">
            <DialogTitle className="text-3xl md:text-5xl font-black uppercase italic text-slate-950 flex items-center justify-center gap-5 tracking-tighter leading-none">
              <MessageSquareCode className="w-8 h-8 md:w-14 md:h-14 text-primary" /> OTP Verification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-12">
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.5em] mb-10">Enter code from bounsibazaar.com</p>
              <form onSubmit={handleSmsVerifyCode} className="space-y-12">
                <Input maxLength={4} placeholder="••••" className="text-center text-6xl h-24 md:h-32 font-black rounded-[2.5rem] border-4 border-slate-50 bg-slate-50/50 tracking-[0.6em] focus:border-primary transition-all shadow-inner text-primary" value={smsVerifyCode} onChange={(e) => setSmsVerifyCode(e.target.value)} />
                <Button type="submit" className="w-full h-20 md:h-28 rounded-[2.5rem] bg-slate-950 text-white font-black uppercase text-sm md:text-2xl border-none shadow-2xl active:scale-95 transition-all">AUTHENTICATE & PAY</Button>
              </form>
            </div>
            <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner group">
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em] mb-4">Verification SMS Context</p>
              <p className="text-2xl md:text-4xl font-black text-primary tracking-[0.4em] italic group-hover:scale-110 transition-transform duration-500">{generatedOtp}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}