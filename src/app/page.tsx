"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, ShoppingBag, Loader2, LayoutGrid, ShoppingCart, Megaphone, LogOut, Mail, Lock, UserPlus, LogIn, UserCircle, MessageSquareCode, Package, Gift, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, PhoneCall, Bell, MapPin, CheckCircle2 } from 'lucide-react';
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
  useUser,
  useAuth,
  initiateEmailSignIn,
  initiateEmailSignUp
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { signOut } from 'firebase/auth';
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
  const [isAdmin, setIsAdmin] = useState(false);
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 

  const GIFT_CHARGE = 20;

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

  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      setIsVerificationDialogOpen(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE) {
      setIsAdmin(true);
      setIsVerificationDialogOpen(false);
      setVerificationCode('');
      toast({ title: "Admin Access Granted", className: "bg-blue-600 text-white font-black" });
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
        title: `Verification Code Sent`, 
        description: `Sender: bounsibazaar.com code. Recipient: ${phoneNumber}. Code: ${result.code}`,
        duration: 10000 
      });
    } catch (err) {
      toast({ title: "Failed to generate OTP", variant: "destructive" });
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
      toast({ title: "Identity Verified" });
    } else {
      toast({ title: "Invalid OTP", variant: "destructive" });
    }
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Email and Password required", variant: "destructive" });
      return;
    }
    if (isSignUp) {
      initiateEmailSignUp(auth, email, password);
    } else {
      initiateEmailSignIn(auth, email, password);
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
      toast({ title: "Order Placed Successfully!" });
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        sendOrder(locLink);
      },
      () => sendOrder("Not provided")
    );
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-green-500 mb-6" />
        <p className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] animate-pulse">Waking Up Bazaar...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-12 shadow-2xl space-y-10 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Bounsi Bazaar</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Entry Portal</p>
          </div>
          
          <form onSubmit={handleAuthSubmit} className="space-y-6">
            <div className="space-y-2 text-left">
              <Label className="text-[11px] font-black uppercase text-slate-400 ml-4">Email Address</Label>
              <div className="relative group">
                <Mail className="absolute left-5 top-5 text-slate-300 w-5 h-5 group-focus-within:text-green-500 transition-colors" />
                <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-16 pl-14 rounded-[1.5rem] border-slate-100 bg-slate-50/50 font-bold focus:bg-white transition-all shadow-inner" />
              </div>
            </div>
            <div className="space-y-2 text-left">
              <Label className="text-[11px] font-black uppercase text-slate-400 ml-4">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-5 top-5 text-slate-300 w-5 h-5 group-focus-within:text-green-500 transition-colors" />
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-16 pl-14 rounded-[1.5rem] border-slate-100 bg-slate-50/50 font-bold focus:bg-white transition-all shadow-inner" />
              </div>
            </div>
            <Button type="submit" className="w-full h-16 rounded-[1.5rem] bg-black text-white font-black uppercase text-sm shadow-xl hover:shadow-2xl active:scale-95 transition-all">
              {isSignUp ? "Create Account" : "Login to Shop"}
            </Button>
          </form>

          <div className="pt-6 border-t border-slate-100">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-[11px] font-black uppercase text-slate-400 hover:text-black transition-colors">
              {isSignUp ? "Already have an account? Login" : "New to Bazaar? Create Account"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (locationStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-6">
        <Loader2 className="w-12 h-12 animate-spin text-green-500" />
        <p className="font-black text-slate-400 text-xs tracking-[0.3em] uppercase">Checking Delivery Zone...</p>
      </div>
    );
  }

  if (locationStatus === 'out_of_range' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-12 text-center gap-10">
        <div className="w-24 h-24 bg-red-50 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-red-50">
          <LayoutGrid className="w-12 h-12 text-red-500" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-slate-900 uppercase italic">Out of Range</h1>
          <p className="text-slate-500 max-w-xs font-bold leading-relaxed">We deliver within 9km of Bounsi (813104). Please enable location to continue.</p>
        </div>
        <Button onClick={() => window.location.reload()} size="lg" className="rounded-full px-12 h-16 bg-black text-white font-black text-sm uppercase shadow-2xl active:scale-95 transition-all">RETRY ACCESS</Button>
        <Button variant="ghost" onClick={() => signOut(auth)} className="text-[11px] font-black uppercase text-slate-400">Logout</Button>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-40 transition-colors duration-700", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <header className="relative z-[60]">
        <div className="bg-yellow-400 text-black py-4 px-6 text-center border-b-2 border-black shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
          <div className="container mx-auto flex items-center justify-center gap-4">
            <Megaphone className="w-6 h-6 animate-bounce shrink-0" />
            <p className="text-sm md:text-base font-black uppercase tracking-tight leading-none italic">
              Welcome to Bounsi Bazaar 🔺🍥🍤🌴💐
              {announcement?.active && ` — ${announcement.message}`}
            </p>
          </div>
        </div>

        <nav className="sticky top-0 glass-nav py-5 shadow-sm">
          <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center justify-between w-full md:w-auto gap-8">
              <h1 className={cn("text-3xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r drop-shadow-sm", currentThemeConfig.gradient)}>
                {currentThemeConfig.title}
              </h1>
              <div className="flex items-center gap-4">
                <div className="relative group">
                   <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors cursor-pointer">
                     <Bell className="w-6 h-6 text-slate-600" />
                   </div>
                   {(announcement?.active || true) && (
                     <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full notification-pulse" />
                   )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="md:hidden text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl h-12 w-12 transition-all">
                  <LogOut className="w-6 h-6" />
                </Button>
              </div>
            </div>
            
            <div className="relative flex-1 w-full max-w-2xl flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-5 top-5 text-slate-400 w-5 h-5" />
                <Input 
                  placeholder="What can we get for you today?" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full h-16 pl-14 pr-14 rounded-[1.5rem] bg-white border-none shadow-xl text-base font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-green-500/20 transition-all" 
                />
              </div>
              {isAdmin && (
                <Button 
                  onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)}
                  className={cn("h-16 w-16 rounded-[1.5rem] shadow-xl transition-all border-none active:scale-90", isAdminPanelVisible ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100")}
                >
                  <ShieldCheck className="w-7 h-7" />
                </Button>
              )}
            </div>

            <Button variant="ghost" onClick={() => signOut(auth)} className="hidden md:flex text-[11px] font-black uppercase text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl h-14 px-6 gap-3 transition-all">
              <LogOut className="w-5 h-5" /> Logout
            </Button>
          </div>
        </nav>
      </header>

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-white/50 backdrop-blur-3xl py-12 border-b-2 border-slate-100 animate-in fade-in slide-in-from-top-10 duration-700">
          <AdminPanel currentTheme={currentTheme} isAdmin={isAdmin} />
        </div>
      )}

      <main className="container mx-auto px-6 py-16">
        <div className="space-y-24">
          {Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
            <section key={section} className="space-y-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-green-50 rounded-[1.5rem] shadow-sm">
                    <LayoutGrid className="w-8 h-8 text-green-500" />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 italic">{section}</h2>
                </div>
                <Badge variant="outline" className="rounded-full px-6 py-2 border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest bg-white">{items.length} ITEMS AVAILABLE</Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                {items.map((p: any) => {
                  const cartItem = cart[p.id];
                  return (
                    <div key={p.id} className="group product-card-premium rounded-[2.5rem] p-5 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="relative aspect-square mb-6 rounded-[2rem] overflow-hidden bg-slate-50 border-2 border-white shadow-inner">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                        {p.isPinned && (
                          <div className="absolute top-4 left-4 bg-yellow-400 text-black px-3 py-1.5 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg">
                            <Pin className="w-3.5 h-3.5 fill-black" /> BEST SELLER
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <h3 className="font-bold text-base text-slate-800 line-clamp-2 uppercase min-h-[3rem] leading-tight">{p.name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-100 text-slate-500 group-hover:bg-green-100 group-hover:text-green-600 border-none rounded-xl text-[10px] font-black uppercase px-3 py-1 transition-colors">
                            {p.unit === 'kg' || p.unit === 'Liter' ? `1 ${p.unit}` : p.unit}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-8 flex items-center justify-between gap-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-300 uppercase leading-none mb-1">Price</span>
                          <span className="text-xl font-black text-slate-900 leading-none">₹{p.price}</span>
                        </div>
                        {cartItem ? (
                          <div className="flex items-center gap-3 bg-green-500 rounded-2xl p-1 flex-1 justify-between shadow-xl shadow-green-100">
                            <Button onClick={() => removeFromCart(p.id)} size="icon" className="h-10 w-10 bg-green-600 hover:bg-green-700 text-white rounded-xl border-none active:scale-90 transition-all">
                              <Minus className="w-5 h-5" />
                            </Button>
                            <span className="text-white font-black text-base">{cartItem.quantity}</span>
                            <Button onClick={() => addToCart(p)} size="icon" className="h-10 w-10 bg-green-600 hover:bg-green-700 text-white rounded-xl border-none active:scale-90 transition-all">
                              <Plus className="w-5 h-5" />
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => addToCart(p)} className="rounded-2xl h-14 px-8 font-black text-sm bg-green-500 text-white hover:bg-green-600 uppercase shadow-xl shadow-green-200/50 active:scale-95 transition-all">
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
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-xl z-[70] animate-in slide-in-from-bottom-20 duration-1000">
          <div className="bg-green-600 text-white rounded-[3rem] p-6 flex items-center justify-between shadow-[0_30px_60px_rgba(34,197,94,0.3)] border-2 border-white/20 backdrop-blur-md">
            <div className="flex items-center gap-6">
              <div className="bg-white/20 p-4 rounded-[1.5rem] backdrop-blur-md shadow-inner">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase leading-tight opacity-70 tracking-widest">{cartCount} ITEM{cartCount > 1 ? 'S' : ''} IN BAG</p>
                <p className="text-3xl font-black leading-tight tracking-tighter italic">₹{cartTotal}</p>
              </div>
            </div>
            <Button onClick={() => setIsPhoneDialogOpen(true)} className="bg-white text-green-700 hover:bg-slate-50 h-16 px-10 rounded-[1.5rem] font-black uppercase text-sm flex items-center gap-3 border-none shadow-2xl active:scale-95 transition-all">
              PROCEED <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      )}

      <Toaster />

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10 max-w-xl border-none shadow-[0_50px_100px_rgba(0,0,0,0.2)] bg-white">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-slate-900 italic">Select Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-8">
            <div className="max-h-[250px] overflow-y-auto space-y-4 pr-3 custom-scrollbar">
              {Object.values(cart).map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-5">
                    <img src={item.imageUrl} className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-white" />
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800 line-clamp-1 mb-1">{item.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.quantity} x {item.unit}</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-slate-900 italic">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Label className="text-[11px] font-black uppercase text-slate-400 ml-4 tracking-[0.2em]">Package Experience</Label>
              <div className="grid grid-cols-2 gap-5">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-6 rounded-[1.5rem] border-2 text-left transition-all group", packagingType === 'Normal' ? "border-green-500 bg-green-50 shadow-lg shadow-green-50" : "border-slate-100 hover:border-slate-200")}>
                  <Package className={cn("w-8 h-8 mb-4", packagingType === 'Normal' ? "text-green-500" : "text-slate-200")} />
                  <p className="text-[12px] font-black uppercase text-slate-900">Standard Delivery</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Included (Free)</p>
                </button>
                <button onClick={() => setPackagingType('Gift')} className={cn("p-6 rounded-[1.5rem] border-2 text-left transition-all group", packagingType === 'Gift' ? "border-pink-500 bg-pink-50 shadow-lg shadow-pink-50" : "border-slate-100 hover:border-slate-200")}>
                  <Gift className={cn("w-8 h-8 mb-4", packagingType === 'Gift' ? "text-pink-500" : "text-slate-200")} />
                  <p className="text-[12px] font-black uppercase text-slate-900">Premium Gift Wrap</p>
                  <p className="text-[10px] font-bold text-pink-500 uppercase mt-1">+₹{GIFT_CHARGE} Fee</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 space-y-4 text-white shadow-2xl">
              <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <span>Cart Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>
              <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <span>Shipping & GST</span>
                <span>₹{cartTotal < 100 ? 125 : 25}</span>
              </div>
              <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                <span className="text-xl font-black uppercase italic tracking-tighter">Amount to Pay</span>
                <span className="text-4xl font-black text-green-400 italic">₹{cartTotal + (cartTotal < 100 ? 125 : 25) + (packagingType === 'Gift' ? GIFT_CHARGE : 0)}</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-4">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-20 rounded-[1.5rem] bg-green-500 text-white font-black text-base uppercase shadow-2xl shadow-green-100 border-none hover:bg-green-600 active:scale-95 transition-all">
                <Smartphone className="w-6 h-6 mr-4" /> Pay with UPI App
              </Button>
              <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-20 rounded-[1.5rem] border-2 border-slate-100 text-slate-600 font-black text-base uppercase hover:bg-slate-50 active:scale-95 transition-all">
                <Banknote className="w-6 h-6 mr-4" /> Cash on Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-[3.5rem] p-12 max-w-sm text-center border-none shadow-[0_50px_100px_rgba(0,0,0,0.3)] bg-white">
          <h3 className="text-2xl font-black uppercase italic mb-8 tracking-tighter">Scan to Pay</h3>
          <div className="p-8 bg-slate-50 rounded-[3rem] border-4 border-white shadow-2xl mb-8 group overflow-hidden">
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-full aspect-square object-contain group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full aspect-square flex items-center justify-center bg-white rounded-3xl"><QrCode className="w-20 h-20 text-slate-200" /></div>}
          </div>
          <div className="bg-green-50 p-4 rounded-2xl mb-10 border border-green-100">
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">VPA ADDRESS</p>
            <p className="text-sm font-black text-slate-900">{settings?.upiId || "NOT_SET@UPI"}</p>
          </div>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-20 rounded-[1.5rem] bg-black text-white font-black uppercase text-base border-none active:scale-95 transition-all shadow-2xl">Confirm Payment</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[3rem] p-12 max-w-md text-center border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black uppercase italic text-slate-900 tracking-tighter">Delivery Info</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-center gap-6 mb-10 bg-slate-50 p-6 rounded-[1.5rem] shadow-inner">
            <UserCircle className={cn("w-7 h-7 transition-colors", !isForSomeoneElse ? "text-green-500" : "text-slate-300")} />
            <Switch checked={isForSomeoneElse} onCheckedChange={setIsForSomeoneElse} />
            <Gift className={cn("w-7 h-7 transition-colors", isForSomeoneElse ? "text-pink-500" : "text-slate-300")} />
            <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Send as a Gift?</span>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-8">
            <div className="space-y-3 text-left">
              <Label className="text-[11px] font-black uppercase text-slate-400 ml-4 tracking-widest">Your 10-Digit Mobile</Label>
              <Input type="tel" placeholder="" maxLength={10} value={phoneNumber} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setPhoneNumber(val); }} className="h-20 text-center text-3xl font-black rounded-[1.5rem] border-2 border-slate-100 bg-white tracking-[0.2em] focus:border-green-500 focus:ring-4 focus:ring-green-500/10 shadow-sm" />
            </div>

            <div className="space-y-3 text-left">
              <Label className="text-[11px] font-black uppercase text-slate-400 ml-4 tracking-widest">Full Delivery Address</Label>
              <Textarea placeholder="Street, Landmark, City..." value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="rounded-[1.5rem] border-2 border-slate-100 bg-white font-bold h-32 p-6 text-base focus:border-green-500 focus:ring-4 focus:ring-green-500/10 shadow-sm resize-none" />
            </div>

            {isForSomeoneElse && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="space-y-3 text-left">
                  <Label className="text-[11px] font-black uppercase text-slate-400 ml-4 tracking-widest">Recipient Mobile Number</Label>
                  <Input type="tel" placeholder="" maxLength={10} value={recipientPhone} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setRecipientPhone(val); }} className="h-16 text-center text-xl font-black rounded-[1.5rem] border-2 border-pink-100 bg-white tracking-widest focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 shadow-sm" />
                </div>
              </div>
            )}

            <Button type="submit" disabled={isOtpLoading} className="w-full h-20 rounded-[1.5rem] bg-green-500 text-white font-black uppercase text-base border-none shadow-2xl shadow-green-100 hover:bg-green-600 active:scale-95 transition-all">
              {isOtpLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : "Verify Identity"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSmsVerifyDialogOpen} onOpenChange={setIsSmsVerifyDialogOpen}>
        <DialogContent className="rounded-[3rem] p-12 max-w-sm text-center border-none shadow-2xl bg-white">
          <DialogHeader className="mb-10">
            <DialogTitle className="text-2xl font-black uppercase italic text-slate-900 flex items-center justify-center gap-4 tracking-tighter">
              <MessageSquareCode className="w-8 h-8 text-green-500" /> Identity Check
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-10">
            <div className="space-y-4">
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Enter code sent by bounsibazaar.com</p>
              <form onSubmit={handleSmsVerifyCode} className="space-y-10">
                <Input maxLength={4} placeholder="••••" className="text-center text-5xl h-24 font-black rounded-[2rem] border-4 border-slate-50 bg-white tracking-[0.8em] focus:border-green-500 focus:ring-8 focus:ring-green-500/5 shadow-inner" value={smsVerifyCode} onChange={(e) => setSmsVerifyCode(e.target.value)} />
                <Button type="submit" className="w-full h-20 rounded-[1.5rem] bg-green-500 text-white font-black uppercase text-base border-none shadow-2xl shadow-green-100 hover:bg-green-600 active:scale-95 transition-all">Complete Verification</Button>
              </form>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">FOR DEMO PURPOSES ONLY</p>
              <p className="text-sm font-black text-green-600 tracking-[0.5em]">{generatedOtp}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[3rem] p-12 max-w-xs text-center border-none shadow-2xl bg-white">
          <DialogHeader className="mb-8"><DialogTitle className="text-2xl font-black uppercase italic text-blue-600 tracking-tighter">Admin Portal</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-8">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-blue-300 tracking-widest">Secret Hub Key</Label>
              <Input maxLength={4} className="text-center text-5xl h-24 font-black rounded-[2rem] border-4 border-blue-50 bg-white tracking-[0.8em] text-blue-600 focus:border-blue-500 shadow-inner" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
            </div>
            <Button type="submit" className="w-full h-16 rounded-[1.5rem] bg-blue-600 text-white font-black uppercase text-sm border-none shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">Unlock Dashboard</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}