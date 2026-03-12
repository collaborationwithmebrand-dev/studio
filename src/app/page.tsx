
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, Loader2, LayoutGrid, ShoppingCart, Megaphone, UserCircle, MessageSquareCode, Package, Gift, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, PhoneCall, ArrowLeft, Zap, Clock, Tag, X, Star } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
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
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
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
      let message = `*BOUNSI BAZAAR ORDER*\n\n*Items:*\n${itemsList}\n\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingType}\n\n`;
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
      setIsQrDialogOpen(false);
      setIsPaymentDialogOpen(false);
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

  const isCheckoutInProgress = isPhoneDialogOpen || isSmsVerifyDialogOpen || isPaymentDialogOpen || isQrDialogOpen || !!selectedProduct;

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
    <div className={cn("min-h-screen relative pb-4 transition-all duration-1000 ease-in-out", currentThemeConfig.bg)}>
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
                  placeholder="Search products, categories..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full h-12 pl-11 rounded-2xl bg-white border-none shadow-inner text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 transition-all" 
                />
              </div>
              <div className="hidden md:flex items-center gap-2">
                {isActuallyAdmin && (
                  <Button 
                    onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)}
                    className={cn("h-12 w-12 rounded-2xl shadow-xl border-none transition-all active:scale-90", isAdminPanelVisible ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600")}
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </Button>
                )}
              </div>
              {isActuallyAdmin && !isAdminPanelVisible && (
                <Button 
                  onClick={() => setIsAdminPanelVisible(true)}
                  className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 border-none shadow-xl md:hidden"
                >
                  <ShieldCheck className="w-6 h-6" />
                </Button>
              )}
            </div>
          </div>
        </nav>
      </header>

      {isActuallyAdmin && isAdminPanelVisible && (
        <div className="bg-white/40 backdrop-blur-3xl py-10 border-b border-slate-100/50 animate-in fade-in slide-in-from-top-10 duration-700">
          <AdminPanel currentTheme={currentTheme} isAdmin={isActuallyAdmin} />
        </div>
      )}

      <main className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-md mx-auto mb-8 md:mb-16">
          <div className="glass-card rounded-full p-1.5 flex items-center shadow-2xl border-white/40 overflow-hidden relative">
            <button 
              onClick={() => setDeliveryFilter('all')}
              className={cn("flex-1 h-10 md:h-12 rounded-full text-[9px] md:text-xs font-black uppercase transition-all duration-500 relative z-10", deliveryFilter === 'all' ? "bg-slate-900 text-white shadow-xl" : "text-slate-400")}
            >
              EVERYTHING
            </button>
            <button 
              onClick={() => setDeliveryFilter('instant')}
              className={cn("flex-1 h-10 md:h-12 rounded-full text-[9px] md:text-xs font-black uppercase transition-all duration-500 relative z-10 flex items-center justify-center gap-2", deliveryFilter === 'instant' ? "bg-primary text-white shadow-xl" : "text-slate-400")}
            >
              <Zap className="w-3.5 h-3.5" /> 25 MIN
            </button>
            <button 
              onClick={() => setDeliveryFilter('standard')}
              className={cn("flex-1 h-10 md:h-12 rounded-full text-[9px] md:text-xs font-black uppercase transition-all duration-500 relative z-10 flex items-center justify-center gap-2", deliveryFilter === 'standard' ? "bg-slate-700 text-white shadow-xl" : "text-slate-400")}
            >
              <Clock className="w-3.5 h-3.5" /> 2 DAYS
            </button>
          </div>
        </div>

        <div className="space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
            {filteredProducts.map((p: any) => {
              const cartItem = cart[p.id];
              const hasMultipleImages = !!p.imageUrl && !!p.imageUrl2;
              
              return (
                <div key={p.id} className="group product-card-premium rounded-[1.5rem] p-2 md:p-3 flex flex-col h-full animate-in fade-in duration-700 scale-in-95 relative bg-white/70 backdrop-blur-sm">
                  <div onClick={() => setSelectedProduct(p)} className="cursor-pointer relative aspect-square mb-2 md:mb-3 rounded-[1.2rem] overflow-hidden bg-slate-50 border border-white shadow-inner">
                    {hasMultipleImages ? (
                      <Carousel className="w-full h-full">
                        <CarouselContent>
                          <CarouselItem>
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          </CarouselItem>
                          <CarouselItem>
                            <img src={p.imageUrl2} alt={`${p.name} view 2`} className="w-full h-full object-cover" />
                          </CarouselItem>
                        </CarouselContent>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/50 backdrop-blur-md" />
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20 backdrop-blur-md" />
                        </div>
                      </Carousel>
                    ) : (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    )}
                    
                    <div className="absolute bottom-1.5 left-1.5 flex flex-col gap-1">
                      {p.deliveryMode === 'standard' ? (
                        <Badge className="bg-slate-900/80 backdrop-blur-md text-white border-none rounded-lg text-[6px] md:text-[8px] font-black flex items-center gap-1 py-0.5 px-1.5">
                          <Clock className="w-2 h-2" /> 2 DAYS
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/90 backdrop-blur-md text-white border-none rounded-lg text-[6px] md:text-[8px] font-black flex items-center gap-1 py-0.5 px-1.5">
                          <Zap className="w-2 h-2" /> 25 MINS
                        </Badge>
                      )}
                    </div>

                    {p.isPinned && (
                      <div className="absolute top-1.5 left-1.5 bg-yellow-400 text-black px-1.5 py-0.5 rounded-lg text-[7px] md:text-[9px] font-black flex items-center gap-1 shadow-xl border border-white/20">
                        <Pin className="w-2.5 h-2.5 fill-black" /> BEST
                      </div>
                    )}
                    
                    {p.category && (
                      <div className="absolute top-1.5 right-1.5">
                        <Badge className="bg-white/80 backdrop-blur-md text-slate-900 border-none rounded-lg text-[6px] md:text-[8px] font-black py-0.5 px-1.5 uppercase flex items-center gap-1">
                          <Tag className="w-2 h-2" /> {p.category}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div onClick={() => setSelectedProduct(p)} className="cursor-pointer flex-1 space-y-1">
                    <h3 className="font-bold text-[10px] md:text-[13px] text-slate-800 line-clamp-2 uppercase min-h-[1.8rem] md:min-h-[2.2rem] leading-tight tracking-tight">{p.name}</h3>
                    <div className="flex items-center gap-1">
                      <Badge className="bg-slate-100 text-slate-500 border-none rounded-md text-[6px] md:text-[8px] font-black uppercase px-1 py-0">
                        {p.unit}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 md:mt-3 flex flex-col gap-2">
                    <div className="flex flex-col">
                      <span className="text-[6px] md:text-[8px] font-black text-slate-300 uppercase leading-none mb-0.5 tracking-wider">Price</span>
                      <span className="text-sm md:text-base font-black text-slate-900 leading-none italic">₹{p.price}</span>
                    </div>
                    {cartItem ? (
                      <div className="flex items-center gap-1 bg-primary rounded-xl p-0.5 flex-1 justify-between shadow-lg border border-white/20">
                        <Button onClick={() => removeFromCart(p.id)} size="icon" className="h-6 w-6 md:h-7 md:w-7 bg-black/10 text-white rounded-lg active:scale-90 hover:bg-black/20 transition-all border-none">
                          <Minus className="w-2.5 h-2.5" />
                        </Button>
                        <span className="text-white font-black text-xs md:text-sm">{cartItem.quantity}</span>
                        <Button onClick={() => addToCart(p)} size="icon" className="h-6 w-6 md:h-7 md:w-7 bg-black/10 text-white rounded-lg active:scale-90 hover:bg-black/20 transition-all border-none">
                          <Plus className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => addToCart(p)} className="rounded-xl h-9 md:h-11 px-2 md:px-3 font-black text-[8px] md:text-[10px] bg-primary text-white hover:brightness-110 uppercase shadow-xl active:scale-95 transition-all border-none tracking-widest">
                        ADD TO BASKET
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {cartCount > 0 && !isCheckoutInProgress && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-[70] animate-in slide-in-from-bottom-20 duration-700">
          <div className="bg-slate-900/95 text-white rounded-[2.5rem] p-4 md:p-6 flex items-center justify-between shadow-[0_30px_100px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-2xl">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="bg-primary p-3 md:p-5 rounded-[1.2rem] shadow-2xl shadow-primary/20">
                <ShoppingCart className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div>
                <p className="text-[9px] md:text-[11px] font-black uppercase leading-tight opacity-50 tracking-[0.2em] mb-0.5">{cartCount} ITEM{cartCount > 1 ? 'S' : ''}</p>
                <p className="text-xl md:text-3xl font-black leading-tight tracking-tighter italic text-green-400">₹{cartTotal}</p>
              </div>
            </div>
            <Button 
              onClick={() => setIsPhoneDialogOpen(true)} 
              className="bg-primary text-white hover:brightness-110 h-12 md:h-16 px-6 md:px-10 rounded-[1.2rem] md:rounded-[1.5rem] font-black uppercase text-[11px] md:text-[14px] flex items-center gap-2 active:scale-95 transition-all border-none shadow-2xl shadow-primary/30"
            >
              PROCEED <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* BLINKIT STYLE PRODUCT DETAIL VIEW */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl p-0 h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden rounded-t-[3rem] md:rounded-[3rem] bg-white border-none shadow-3xl animate-in slide-in-from-bottom-20 duration-500">
          {selectedProduct && (
            <div className="flex flex-col h-full">
              <div className="relative h-[45%] md:h-[400px] w-full bg-slate-50 group">
                <DialogClose className="absolute top-6 left-6 z-50 p-3 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl hover:bg-white transition-all active:scale-90 border-none outline-none">
                  <ArrowLeft className="w-5 h-5 text-slate-900" />
                </DialogClose>
                <Carousel className="w-full h-full">
                  <CarouselContent className="h-full">
                    <CarouselItem className="h-full">
                      <img src={selectedProduct.imageUrl} className="w-full h-full object-contain md:object-cover" alt={selectedProduct.name} />
                    </CarouselItem>
                    {selectedProduct.imageUrl2 && (
                      <CarouselItem className="h-full">
                        <img src={selectedProduct.imageUrl2} className="w-full h-full object-contain md:object-cover" alt={selectedProduct.name} />
                      </CarouselItem>
                    )}
                  </CarouselContent>
                </Carousel>
                {selectedProduct.isPinned && (
                  <div className="absolute top-6 right-6 bg-yellow-400 text-black px-3 py-1.5 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-2xl border border-white/40">
                    <Star className="w-3.5 h-3.5 fill-black" /> BESTSELLER
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto px-8 py-10 space-y-8 custom-scrollbar">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/10 text-primary border-none rounded-xl text-[10px] font-black px-3 py-1 uppercase tracking-widest">
                      {selectedProduct.category || "General"}
                    </Badge>
                    <Badge className={cn("border-none rounded-xl text-[10px] font-black px-3 py-1 uppercase tracking-widest", 
                      selectedProduct.deliveryMode === 'instant' ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                    )}>
                      {selectedProduct.deliveryMode === 'instant' ? "25 MINS" : "2 DAYS"}
                    </Badge>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black text-slate-900 leading-none italic uppercase tracking-tighter">{selectedProduct.name}</h2>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{selectedProduct.unit}</p>
                </div>

                <div className="space-y-4 pt-6 border-t border-slate-50">
                  <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Product Details</h4>
                  <p className="text-slate-600 text-sm md:text-base leading-relaxed font-medium">
                    {selectedProduct.description || "Fresh, premium quality product sourced directly for Bounsi Bazaar. Hand-picked for the best experience."}
                  </p>
                </div>

                <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex-1 space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Return Policy</p>
                    <p className="text-[11px] font-bold text-slate-600">No questions asked return if not satisfied.</p>
                  </div>
                  <ShieldCheck className="w-8 h-8 text-primary opacity-30" />
                </div>
              </div>

              <div className="p-8 border-t border-slate-50 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Total Price</span>
                  <span className="text-3xl font-black text-slate-900 italic">₹{selectedProduct.price}</span>
                </div>
                {cart[selectedProduct.id] ? (
                  <div className="flex items-center gap-4 bg-primary rounded-[1.5rem] p-2 flex-1 max-w-[180px] justify-between shadow-2xl shadow-primary/20">
                    <Button onClick={() => removeFromCart(selectedProduct.id)} size="icon" className="h-10 w-10 md:h-12 md:w-12 bg-black/10 text-white rounded-xl active:scale-90 border-none">
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="text-white font-black text-lg">{cart[selectedProduct.id].quantity}</span>
                    <Button onClick={() => addToCart(selectedProduct)} size="icon" className="h-10 w-10 md:h-12 md:w-12 bg-black/10 text-white rounded-xl active:scale-90 border-none">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => addToCart(selectedProduct)} className="flex-1 h-16 rounded-[1.5rem] bg-primary text-white font-black uppercase text-sm shadow-2xl shadow-primary/30 border-none hover:brightness-110 active:scale-95 transition-all italic">
                    ADD TO BASKET
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Toaster />

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 md:p-12 max-md:max-w-[95%] text-center bg-white border-none shadow-2xl">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-2xl md:text-3xl font-black uppercase italic text-blue-600 tracking-tighter leading-none">Admin Hub Unlock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-8">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em]">Verification Key</Label>
              <Input 
                type="password"
                maxLength={4} 
                className="text-center text-4xl h-16 md:h-20 font-black rounded-2xl border-2 border-slate-50 bg-slate-50/50 tracking-[0.4em] text-blue-600 focus:border-blue-500 shadow-inner transition-all" 
                value={verificationCode} 
                onChange={(e) => setVerificationCode(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full h-14 md:h-16 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs md:text-sm border-none shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Authenticate Tools</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-6 md:p-10 max-md:max-w-[95%] bg-white border-none shadow-2xl overflow-hidden">
          <Button variant="ghost" onClick={() => { setIsPaymentDialogOpen(false); setIsSmsVerifyDialogOpen(true); }} className="absolute left-4 top-4 h-10 w-10 p-0 rounded-xl text-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <DialogHeader className="mb-8 mt-4">
            <DialogTitle className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-slate-900 italic leading-none">Order Summary</DialogTitle>
          </DialogHeader>

          <div className="space-y-8">
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-[0.3em]">Packaging Style</Label>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-4 md:p-6 rounded-[1.5rem] border-2 text-left transition-all duration-500", packagingType === 'Normal' ? "border-primary bg-primary/5 shadow-xl" : "border-slate-50 hover:border-slate-100")}>
                  <Package className={cn("w-6 h-6 md:w-8 md:h-8 mb-3", packagingType === 'Normal' ? "text-primary" : "text-slate-200")} />
                  <p className="text-[10px] md:text-xs font-black uppercase text-slate-900 leading-tight">Standard</p>
                </button>
                <button onClick={() => setPackagingType('Special')} className={cn("p-4 md:p-6 rounded-[1.5rem] border-2 text-left transition-all duration-500", packagingType === 'Special' ? "border-pink-500 bg-pink-50 shadow-xl" : "border-slate-50 hover:border-slate-100")}>
                  <Gift className={cn("w-6 h-6 md:w-8 md:h-8 mb-3", packagingType === 'Special' ? "text-pink-500" : "text-slate-200")} />
                  <p className="text-[10px] md:text-xs font-black uppercase text-slate-900 leading-tight">Someone Else's Premium</p>
                  <p className="text-[8px] md:text-[9px] font-bold text-pink-500 uppercase mt-1">+₹{SOMEONE_ELSES_CHARGE}</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-[2rem] p-6 md:p-8 space-y-6 text-white shadow-2xl">
              <div className="space-y-3 pb-4 border-b border-white/10 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">Itemized Receipt</Label>
                {Object.values(cart).map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-[11px] md:text-sm">
                    <span className="font-bold uppercase truncate max-w-[150px] text-slate-200">{item.quantity}x {item.name}</span>
                    <span className="font-black italic text-slate-400">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Cart Subtotal</span>
                  <span className="text-slate-300">₹{cartTotal}</span>
                </div>
                <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Priority Delivery</span>
                  <span className="text-slate-300">₹{orderBreakdown.deliveryCharge}</span>
                </div>
                {orderBreakdown.taxAndGst > 0 && (
                  <div className="flex justify-between text-[9px] font-black text-yellow-400 uppercase tracking-widest animate-pulse">
                    <span>Taxes &amp; GST (Min Order adj.)</span>
                    <span>₹{orderBreakdown.taxAndGst}</span>
                  </div>
                )}
              </div>
              
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-xl font-black uppercase italic tracking-tighter leading-none">Grand Total</span>
                <span className="text-3xl md:text-5xl font-black text-primary italic leading-none">₹{orderBreakdown.finalPrice}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col md:flex-row gap-4">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-14 md:h-20 flex-1 rounded-[1.2rem] bg-primary text-white font-black text-xs md:text-sm uppercase shadow-2xl border-none hover:brightness-110 active:scale-95 transition-all">
                <Smartphone className="w-5 h-5 mr-3" /> UPI SECURE
              </Button>
              <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-14 md:h-20 flex-1 rounded-[1.2rem] border-2 border-slate-50 text-slate-500 font-black text-xs md:text-sm uppercase hover:bg-slate-50 active:scale-95 transition-all">
                <Banknote className="w-5 h-5 mr-3" /> PAY ON DELIVERY
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-md:max-w-[95%] text-center bg-white border-none shadow-2xl">
          <Button variant="ghost" onClick={() => { setIsQrDialogOpen(false); setIsPaymentDialogOpen(true); }} className="absolute left-4 top-4 h-10 w-10 p-0 rounded-xl text-slate-300">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-xl md:text-3xl font-black uppercase italic mb-8 mt-6 tracking-tighter leading-none">Scan to Pay</h3>
          <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-white shadow-inner mb-8">
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-full aspect-square object-contain rounded-xl" /> : <div className="w-full aspect-square flex items-center justify-center bg-white rounded-xl"><QrCode className="w-16 h-16 text-slate-100" /></div>}
          </div>
          <div className="bg-primary/5 p-4 rounded-xl mb-8 border border-primary/10">
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em] mb-1">Merchant UPI ID</p>
            <p className="text-sm font-black text-slate-900 tracking-tight">{settings?.upiId || "NOT_SET@UPI"}</p>
          </div>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-16 rounded-2xl bg-slate-950 text-white font-black uppercase text-xs md:text-sm border-none active:scale-95 transition-all shadow-xl">CONFIRM PAYMENT</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 md:p-12 max-md:max-w-[95%] text-center bg-white border-none shadow-2xl">
          <Button variant="ghost" onClick={() => setIsPhoneDialogOpen(false)} className="absolute left-4 top-4 h-10 w-10 p-0 rounded-xl text-slate-300">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <DialogHeader className="mb-10 mt-4">
            <DialogTitle className="text-2xl md:text-4xl font-black uppercase italic text-slate-900 tracking-tighter leading-none">Delivery Details</DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-center gap-6 mb-10 bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
            <div className="flex flex-col items-center gap-2">
              <div className={cn("p-3 rounded-xl transition-all duration-500 shadow-lg", !isForSomeoneElse ? "bg-primary text-white scale-110" : "bg-white text-slate-200")}>
                <UserCircle className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Self</span>
            </div>
            <Switch checked={isForSomeoneElse} onCheckedChange={setIsForSomeoneElse} className="scale-125 data-[state=checked]:bg-pink-500" />
            <div className="flex flex-col items-center gap-2">
              <div className={cn("p-3 rounded-xl transition-all duration-500 shadow-lg", isForSomeoneElse ? "bg-pink-500 text-white scale-110" : "bg-white text-slate-200")}>
                <Gift className="w-6 h-6" />
              </div>
              <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Someone Else's</span>
            </div>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-6 md:space-y-8 text-left">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-300 ml-4 tracking-[0.2em]">Mobile Number</Label>
              <Input 
                type="tel" 
                placeholder="00000 00000" 
                maxLength={10} 
                value={phoneNumber} 
                onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setPhoneNumber(val); }} 
                className="h-16 md:h-20 text-center text-2xl md:text-4xl font-black rounded-[1.2rem] border-2 border-slate-50 bg-slate-50/50 tracking-[0.2em] focus:border-primary transition-all shadow-inner" 
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-300 ml-4 tracking-[0.2em]">Drop Location</Label>
              <Textarea placeholder="Building, Street, Landmark..." value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="rounded-[1.2rem] border-2 border-slate-50 bg-slate-50/50 font-bold h-24 md:h-32 p-4 md:p-6 text-sm md:text-lg focus:border-primary transition-all shadow-inner placeholder:text-slate-200" />
            </div>

            {isForSomeoneElse && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <Label className="text-[10px] font-black uppercase text-pink-300 ml-4 tracking-[0.2em]">Recipient's Phone</Label>
                <Input type="tel" placeholder="10 Digit Number" maxLength={10} value={recipientPhone} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); if (val.length <= 10) setRecipientPhone(val); }} className="h-14 md:h-16 text-center text-xl md:text-2xl font-black rounded-[1.2rem] border-2 border-pink-50 bg-pink-50/30 tracking-[0.1em] focus:border-pink-500 shadow-inner" />
              </div>
            )}

            <Button type="submit" disabled={isOtpLoading} className="w-full h-16 md:h-20 rounded-[1.5rem] bg-slate-950 text-white font-black uppercase text-xs md:text-sm border-none shadow-xl active:scale-95 transition-all">
              {isOtpLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "VERIFY IDENTITY"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSmsVerifyDialogOpen} onOpenChange={setIsSmsVerifyDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 md:p-14 max-md:max-w-[95%] text-center bg-white border-none shadow-2xl">
          <Button variant="ghost" onClick={() => { setIsSmsVerifyDialogOpen(false); setIsPhoneDialogOpen(true); }} className="absolute left-4 top-4 h-10 w-10 p-0 rounded-xl text-slate-300">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <DialogHeader className="mb-8 mt-4">
            <DialogTitle className="text-2xl md:text-4xl font-black uppercase italic text-slate-950 flex items-center justify-center gap-4 tracking-tighter leading-none">
              <MessageSquareCode className="w-6 h-6 md:w-10 md:h-10 text-primary" /> OTP Verification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <div className="space-y-6">
              <p className="text-[9px] font-black uppercase text-slate-300 tracking-[0.4em] mb-8">Enter code from bounsibazaar.com</p>
              <form onSubmit={handleSmsVerifyCode} className="space-y-8">
                <Input maxLength={4} placeholder="••••" className="text-center text-4xl h-16 md:h-24 font-black rounded-[1.5rem] border-2 border-slate-50 bg-slate-50/50 tracking-[0.5em] focus:border-primary transition-all shadow-inner text-primary" value={smsVerifyCode} onChange={(e) => setSmsVerifyCode(e.target.value)} />
                <Button type="submit" className="w-full h-16 md:h-20 rounded-[1.5rem] bg-slate-950 text-white font-black uppercase text-xs md:text-sm border-none shadow-xl active:scale-95 transition-all">AUTHENTICATE &amp; PAY</Button>
              </form>
            </div>
            <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner group">
              <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-2">Verification SMS Context</p>
              <p className="text-xl md:text-3xl font-black text-primary tracking-[0.3em] italic">{generatedOtp}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
