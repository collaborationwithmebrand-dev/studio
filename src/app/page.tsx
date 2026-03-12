
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, Loader2, LayoutGrid, ShoppingCart, Megaphone, UserCircle, MessageSquareCode, Package, Gift, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, PhoneCall, ArrowLeft, Zap, Clock, MapPin, X, CheckCircle2 } from 'lucide-react';
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
import { collection, doc, query } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { generateOtp } from '@/ai/flows/send-otp-flow';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

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

type CheckoutStep = 'details' | 'otp' | 'payment' | 'qr' | null;

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(null);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isForSomeoneElse, setIsForSomeoneElse] = useState(false);
  const [packagingType, setPackagingType] = useState<'Normal' | 'Special'>('Normal');
  const [verificationCode, setVerificationCode] = useState('');
  const [smsVerifyCode, setSmsVerifyCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'out_of_range'>('allowed');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'instant' | 'standard'>('all');

  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 
  const SOMEONE_ELSES_CHARGE = 20;

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
      setCheckoutStep('otp');
      toast({ 
        title: `Verification Sent`, 
        description: `Code: ${result.code}`,
        duration: 8000 
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
      setCheckoutStep('payment');
      setSmsVerifyCode('');
      toast({ title: "Identity Verified", className: "bg-green-600 text-white" });
    } else {
      toast({ title: "Invalid OTP", variant: "destructive" });
    }
  };

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products } = useCollection(productsQuery);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products
      .filter(p => {
        const term = searchQuery.toLowerCase();
        const matchesSearch = (
          p.name.toLowerCase().includes(term) || 
          (p.section && p.section.toLowerCase().includes(term)) ||
          (p.category && p.category.toLowerCase().includes(term))
        );
        const matchesFilter = 
          deliveryFilter === 'all' || 
          (deliveryFilter === 'instant' && p.deliveryMode === 'instant') ||
          (deliveryFilter === 'standard' && p.deliveryMode === 'standard');
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
  }, [products, searchQuery, deliveryFilter]);

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

  const orderBreakdown = useMemo(() => {
    const deliveryCharge = 25;
    const someoneElsesFee = packagingType === 'Special' ? SOMEONE_ELSES_CHARGE : 0;
    const initialTotal = cartTotal + deliveryCharge + someoneElsesFee;
    const taxAndGst = initialTotal < 100 ? (100 - initialTotal) : 0;
    const finalPrice = initialTotal + taxAndGst;
    return { deliveryCharge, someoneElsesFee, taxAndGst, finalPrice };
  }, [cartTotal, packagingType]);

  const finalizeOrder = (method: 'COD' | 'UPI') => {
    if (!user) return;
    const { finalPrice } = orderBreakdown;
    const itemsList = Object.values(cart).map(item => `• ${item.name} (${item.quantity} ${item.unit})`).join('\n');
    
    const sendOrder = (locationData: string) => {
      let message = `*ORDER DETAILS*\n\n*Items:*\n${itemsList}\n\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingType}\n\n`;
      message += `*Delivery Address:* ${deliveryAddress}\n`;
      if (isForSomeoneElse) {
        message += `*SOMEONE ELSE'S ORDER*\n*Sender:* ${phoneNumber}\n*Recipient:* ${recipientPhone}\n\n`;
      } else {
        message += `*Phone:* ${phoneNumber}\n\n`;
      }
      message += `*Map Location:* ${locationStatus === 'allowed' ? locationData : "Location not allowed"}\n\n`;
      message += `_Fast Delivery Guaranteed!_ ⚡`;
      
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
      setCheckoutStep(null);
      setCart({});
      toast({ title: "Order Placed Successfully!", className: "bg-green-600 text-white" });
    };

    if (locationStatus === 'allowed') {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
          sendOrder(locLink);
        },
        () => sendOrder("Location not allowed")
      );
    } else {
      sendOrder("Location not allowed");
    }
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

  if (checkoutStep) {
    return (
      <div className="min-h-screen bg-white p-4 md:p-10 animate-in fade-in slide-in-from-right-10 duration-500">
        <div className="max-w-2xl mx-auto space-y-10">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setCheckoutStep(prev => prev === 'details' ? null : prev === 'otp' ? 'details' : prev === 'payment' ? 'otp' : 'payment')} className="rounded-xl h-12 w-12 p-0 text-slate-400 hover:text-slate-900">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">Checkout</h2>
            <div className="w-12" />
          </div>

          {checkoutStep === 'details' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className="flex items-center justify-center gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn("p-4 rounded-2xl transition-all duration-500 shadow-xl", !isForSomeoneElse ? "bg-primary text-white scale-110" : "bg-white text-slate-200")}>
                    <UserCircle className="w-6 h-6" />
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Self Order</span>
                </div>
                <Switch checked={isForSomeoneElse} onCheckedChange={setIsForSomeoneElse} className="scale-150 data-[state=checked]:bg-pink-500" />
                <div className="flex flex-col items-center gap-2">
                  <div className={cn("p-4 rounded-2xl transition-all duration-500 shadow-xl", isForSomeoneElse ? "bg-pink-500 text-white scale-110" : "bg-white text-slate-200")}>
                    <Gift className="w-6 h-6" />
                  </div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Someone Else's</span>
                </div>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-300 ml-5">Phone Number</Label>
                  <Input type="tel" maxLength={10} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="h-16 md:h-20 text-center text-3xl font-black rounded-[1.5rem] border-none bg-slate-50 tracking-[0.2em] focus:ring-2 focus:ring-primary shadow-inner" placeholder="00000 00000" />
                </div>
                <div className="space-y-3">
                  <Label className="text-[11px] font-black uppercase text-slate-300 ml-5">Delivery Address</Label>
                  <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="rounded-[1.5rem] border-none bg-slate-50 font-bold h-24 p-5 text-sm md:text-lg focus:ring-2 focus:ring-primary shadow-inner" placeholder="Full address with landmark..." />
                </div>
                {isForSomeoneElse && (
                  <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
                    <Label className="text-[11px] font-black uppercase text-pink-300 ml-5">Recipient's Mobile</Label>
                    <Input type="tel" maxLength={10} value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, ''))} className="h-16 text-center text-2xl font-black rounded-[1.5rem] border-none bg-pink-50/30 tracking-[0.1em] focus:ring-2 focus:ring-pink-500 shadow-inner" placeholder="10 Digit Number" />
                  </div>
                )}
                <Button type="submit" disabled={isOtpLoading} className="w-full h-16 rounded-[1.5rem] bg-slate-950 text-white font-black uppercase italic shadow-2xl active:scale-95 transition-all">
                  {isOtpLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Continue"}
                </Button>
              </form>
            </div>
          )}

          {checkoutStep === 'otp' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-primary/5">
                  <MessageSquareCode className="w-10 h-10 text-primary" />
                </div>
                <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.4em]">Verify SMS Code</p>
              </div>
              <form onSubmit={handleSmsVerifyCode} className="space-y-8">
                <Input maxLength={4} value={smsVerifyCode} onChange={(e) => setSmsVerifyCode(e.target.value)} className="h-20 md:h-24 text-center text-5xl font-black rounded-[2rem] border-none bg-slate-50 tracking-[0.5em] text-primary focus:ring-2 focus:ring-primary shadow-inner" placeholder="••••" />
                <Button type="submit" className="w-full h-16 rounded-[1.5rem] bg-slate-950 text-white font-black uppercase italic shadow-2xl">Confirm Identity</Button>
              </form>
              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 text-center shadow-inner">
                <p className="text-[9px] font-bold text-slate-300 uppercase mb-2">Simulated SMS Code</p>
                <p className="text-3xl font-black text-primary italic tracking-widest">{generatedOtp}</p>
              </div>
            </div>
          )}

          {checkoutStep === 'payment' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-5 rounded-[1.8rem] border-2 text-left transition-all duration-500", packagingType === 'Normal' ? "border-primary bg-primary/5 shadow-xl" : "border-slate-50 bg-white")}>
                  <Package className={cn("w-8 h-8 mb-3", packagingType === 'Normal' ? "text-primary" : "text-slate-200")} />
                  <p className="text-[11px] font-black uppercase text-slate-900 italic">Standard</p>
                </button>
                <button onClick={() => setPackagingType('Special')} className={cn("p-5 rounded-[1.8rem] border-2 text-left transition-all duration-500", packagingType === 'Special' ? "border-pink-500 bg-pink-50 shadow-xl" : "border-slate-50 bg-white")}>
                  <Gift className={cn("w-8 h-8 mb-3", packagingType === 'Special' ? "text-pink-500" : "text-slate-200")} />
                  <p className="text-[11px] font-black uppercase text-slate-900 italic">Someone Else's</p>
                  <p className="text-[8px] font-black text-pink-500 mt-1">+₹{SOMEONE_ELSES_CHARGE}</p>
                </button>
              </div>

              <div className="bg-slate-950 rounded-[2.5rem] p-8 space-y-8 text-white shadow-[0_40_100px_rgba(0,0,0,0.3)]">
                <div className="space-y-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                  {Object.values(cart).map(item => (
                    <div key={item.id} className="flex justify-between items-center">
                      <p className="text-xs font-bold text-slate-400 uppercase italic truncate max-w-[180px]">{item.quantity}x {item.name}</p>
                      <p className="text-sm font-black italic">₹{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest"><span>Subtotal</span><span>₹{cartTotal}</span></div>
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest"><span>Priority Delivery</span><span>₹{orderBreakdown.deliveryCharge}</span></div>
                  {orderBreakdown.taxAndGst > 0 && <div className="flex justify-between text-[9px] font-black text-yellow-400 uppercase tracking-widest"><span>Taxes & GST (Min Order adj.)</span><span>₹{orderBreakdown.taxAndGst}</span></div>}
                </div>
                <div className="pt-6 border-t border-white/10 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase italic mb-1">Grand Total</p>
                    <p className="text-5xl font-black text-primary italic tracking-tighter leading-none">₹{orderBreakdown.finalPrice}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-red-500 uppercase bg-red-500/10 px-2 py-1 rounded-lg italic">No Return Policy</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <Button onClick={() => settings?.upiQrUrl ? setCheckoutStep('qr') : finalizeOrder('UPI')} className="h-20 rounded-[1.8rem] bg-primary text-white font-black uppercase italic shadow-2xl border-none text-base">
                  <Smartphone className="w-6 h-6 mr-3" /> Pay Secure UPI
                </Button>
                <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-20 rounded-[1.8rem] border-2 border-slate-50 text-slate-500 font-black uppercase italic text-sm">
                  <Banknote className="w-6 h-6 mr-3" /> Pay On Delivery
                </Button>
              </div>
            </div>
          )}

          {checkoutStep === 'qr' && (
            <div className="space-y-10 text-center animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className="p-10 bg-slate-50 rounded-[3rem] border-4 border-white shadow-inner mx-auto max-w-sm">
                <DialogHeader className="sr-only"><DialogTitle>QR Payment Code</DialogTitle></DialogHeader>
                {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-full aspect-square object-contain rounded-2xl" /> : <QrCode className="w-32 h-32 text-slate-100 mx-auto" />}
              </div>
              <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/10 inline-block">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2">Merchant UPI</p>
                <p className="text-xl font-black text-slate-900 italic">{settings?.upiId || "NOT_SET@UPI"}</p>
              </div>
              <Button onClick={() => finalizeOrder('UPI')} className="w-full h-20 rounded-[2rem] bg-slate-950 text-white font-black uppercase italic shadow-2xl text-base">Confirm Payment</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-4 transition-all duration-1000 ease-in-out", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <header className="relative z-[60]">
        <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 text-black py-3 px-4 text-center border-b-2 border-black/10 shadow-lg">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <Megaphone className="w-4 h-4 md:w-5 md:h-5 animate-bounce shrink-0" />
            <p className="text-[10px] md:text-sm font-black uppercase tracking-tight italic">
              {settings?.freeDeliveryMessage || "FREE DELIVERY ON ALL ORDERS 🔺🍥🍤🌴💐"}
              {announcement?.active && ` — ${announcement.message}`}
            </p>
          </div>
        </div>

        <nav className="sticky top-0 glass-nav py-6 shadow-xl z-50">
          <div className="container mx-auto px-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-slate-900 leading-none">
                  {settings?.estimatedDeliveryTime || "17-25 min"}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {isActuallyAdmin && (
                  <Button 
                    onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)}
                    className={cn("h-14 w-14 rounded-2xl shadow-xl border-none transition-all active:scale-90", isAdminPanelVisible ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600")}
                  >
                    <ShieldCheck className="w-7 h-7" />
                  </Button>
                )}
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-8 h-8 text-slate-300" />
                </div>
              </div>
            </div>
            
            <div className="relative flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-4 text-slate-400 w-5 h-5" />
                <Input 
                  placeholder="Search for snacks, essentials..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full h-14 pl-12 rounded-2xl bg-white border-none shadow-inner text-base font-bold" 
                />
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

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto mb-10">
          <div className="glass-card rounded-full p-1.5 flex items-center shadow-2xl border-white/40 overflow-hidden">
            <button onClick={() => setDeliveryFilter('all')} className={cn("flex-1 h-12 rounded-full text-[10px] font-black uppercase transition-all duration-500", deliveryFilter === 'all' ? "bg-slate-900 text-white shadow-xl" : "text-slate-400")}>EVERYTHING</button>
            <button onClick={() => setDeliveryFilter('instant')} className={cn("flex-1 h-12 rounded-full text-[10px] font-black uppercase transition-all duration-500 flex items-center justify-center gap-2", deliveryFilter === 'instant' ? "bg-primary text-white shadow-xl" : "text-slate-400")}><Zap className="w-4 h-4" /> 25 MIN</button>
            <button onClick={() => setDeliveryFilter('standard')} className={cn("flex-1 h-12 rounded-full text-[10px] font-black uppercase transition-all duration-500 flex items-center justify-center gap-2", deliveryFilter === 'standard' ? "bg-slate-700 text-white shadow-xl" : "text-slate-400")}><Clock className="w-4 h-4" /> 2 DAYS</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
          {filteredProducts.map((p: any) => {
            const cartItem = cart[p.id];
            const hasMultipleImages = !!p.imageUrl && !!p.imageUrl2;
            
            return (
              <div 
                key={p.id} 
                onClick={() => addToCart(p)}
                className="group product-card-premium rounded-[1.5rem] p-2 flex flex-col h-full animate-in fade-in duration-700 relative bg-white/70 backdrop-blur-sm cursor-pointer active:scale-95 transition-transform"
              >
                <div className="relative aspect-square mb-2 rounded-[1.2rem] overflow-hidden bg-slate-50">
                  {hasMultipleImages ? (
                    <Carousel className="w-full h-full">
                      <CarouselContent>
                        <CarouselItem><img src={p.imageUrl} className="w-full h-full object-cover" /></CarouselItem>
                        <CarouselItem><img src={p.imageUrl2} className="w-full h-full object-cover" /></CarouselItem>
                      </CarouselContent>
                    </Carousel>
                  ) : (
                    <img src={p.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  )}
                  <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-1">
                    <Badge className={cn("text-[6px] md:text-[8px] font-black flex items-center gap-1 border-none py-0.5 px-1.5", p.deliveryMode === 'standard' ? "bg-slate-900/80 text-white" : "bg-primary/90 text-white")}>
                      {p.deliveryMode === 'standard' ? <Clock className="w-2 h-2" /> : <Zap className="w-2 h-2" />} {p.deliveryMode === 'standard' ? '2 DAYS' : '25 MINS'}
                    </Badge>
                  </div>
                  {p.isPinned && <div className="absolute top-1.5 left-1.5 bg-yellow-400 text-black px-1.5 py-0.5 rounded-lg text-[7px] font-black flex items-center gap-1"><Pin className="w-2.5 h-2.5 fill-black" /> BEST</div>}
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="font-bold text-[10px] md:text-[12px] text-slate-800 line-clamp-2 uppercase leading-tight italic">{p.name}</h3>
                  <Badge className="bg-slate-100 text-slate-500 border-none rounded-md text-[7px] font-black uppercase px-1 py-0">{p.unit}</Badge>
                  <p className="text-xs font-black text-slate-900 italic">₹{p.price}</p>
                </div>
                <div className="mt-3">
                  {cartItem ? (
                    <div className="flex items-center gap-1 bg-primary rounded-xl p-0.5 justify-between shadow-lg">
                      <Button onClick={(e) => { e.stopPropagation(); removeFromCart(p.id); }} size="icon" className="h-6 w-6 bg-black/10 text-white rounded-lg border-none"><Minus className="w-2.5 h-2.5" /></Button>
                      <span className="text-white font-black text-xs">{cartItem.quantity}</span>
                      <Button onClick={(e) => { e.stopPropagation(); addToCart(p); }} size="icon" className="h-6 w-6 bg-black/10 text-white rounded-lg border-none"><Plus className="w-2.5 h-2.5" /></Button>
                    </div>
                  ) : (
                    <Button onClick={(e) => { e.stopPropagation(); addToCart(p); }} className="w-full rounded-xl h-9 font-black text-[9px] bg-primary text-white uppercase shadow-xl border-none italic">Add to Basket</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-10 right-4 z-[70] animate-in slide-in-from-right-20 duration-700">
          <button 
            onClick={() => setCheckoutStep('details')}
            className="group flex items-center gap-3 bg-green-600 text-white p-2 pl-5 rounded-full shadow-[0_20px_60px_rgba(22,163,74,0.4)] hover:scale-105 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
                <img src={Object.values(cart)[0]?.imageUrl} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col items-start leading-none">
                <p className="text-[11px] font-black uppercase tracking-tight">View Cart</p>
                <p className="text-[9px] font-bold opacity-80">{cartCount} items</p>
              </div>
            </div>
            <div className="bg-white/10 h-10 px-6 rounded-full flex items-center gap-2 border border-white/20">
              <span className="text-[12px] font-black italic">₹{orderBreakdown.finalPrice}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      <Toaster />

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-md:max-w-[95%] text-center bg-white border-none shadow-2xl">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-2xl font-black uppercase italic text-blue-600 tracking-tighter text-center w-full">Admin Unlock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-300">Verification Key</Label>
              <Input type="password" maxLength={4} className="text-center text-4xl h-16 font-black rounded-2xl border-none bg-slate-50 shadow-inner text-blue-600" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs italic shadow-xl">Unlock Tools</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
