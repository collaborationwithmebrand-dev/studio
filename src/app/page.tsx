
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, ShoppingBag, Loader2, LayoutGrid, PhoneCall, MapPin, Package, Gift, ChevronRight, Smartphone, Banknote, QrCode, Pin, Plus, Minus, ShoppingCart, Megaphone } from 'lucide-react';
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
  setDocumentNonBlocking,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const { toast } = useToast();

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  
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
      toast({ title: "Admin Access Granted" });
    } else {
      toast({ title: "Invalid Code", variant: "destructive" });
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({ title: "Invalid Phone Number", variant: "destructive" });
      return;
    }
    setIsPhoneDialogOpen(false);
    setIsPaymentDialogOpen(true);
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
    const finalPrice = cartTotal + (cartTotal < 100 ? 125 : 25) + (packagingType === 'Gift' ? 40 : 0);
    const itemsList = Object.values(cart).map(item => `• ${item.name} (${item.quantity} ${item.unit})`).join('\n');
    
    navigator.geolocation.getCurrentPosition((pos) => {
      const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      const message = `*BOUNSI BAZAAR ORDER*\n\n*Items:*\n${itemsList}\n\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingType}\n*Location:* ${locLink}\n*Phone:* ${phoneNumber}\n\n_Fast Delivery (30 min)!_ ⚡`;
      
      addDocumentNonBlocking(collection(firestore, 'orders'), {
        phoneNumber: phoneNumber,
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
    });
  };

  if (locationStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-green-500" />
        <p className="font-bold text-slate-400 text-xs tracking-widest uppercase">Opening Bazaar...</p>
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
          </div>
          
          <div className="relative flex-1 w-full max-w-xl group">
            <Search className="absolute left-4 top-4 text-slate-400 w-4 h-4" />
            <Input 
              placeholder="Search items, sections..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full h-12 pl-12 pr-12 rounded-2xl bg-slate-50 border-none shadow-inner text-sm font-bold placeholder:text-slate-400" 
            />
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)}
                className="absolute right-2 top-1.5 h-9 w-9 text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <ShieldCheck className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-white py-10 border-b animate-in fade-in slide-in-from-top-4 duration-500">
          <AdminPanel currentTheme={currentTheme} isAdmin={isAdmin} />
        </div>
      )}

      <main className="container mx-auto px-4 py-10">
        <div className="space-y-16">
          {Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
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
                          <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1">
                            <Pin className="w-3 h-3 fill-black" /> TOP PICK
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="font-bold text-sm text-slate-800 line-clamp-2 uppercase min-h-[2.5rem]">{p.name}</h3>
                        <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-none rounded-lg text-[9px] font-black uppercase">
                          {p.unit === 'kg' || p.unit === 'Liter' ? `1 ${p.unit}` : p.unit}
                        </Badge>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <span className="text-base font-black text-slate-900">₹{p.price}</span>
                        {cartItem ? (
                          <div className="flex items-center gap-2 bg-green-500 rounded-xl p-1 flex-1 justify-between shadow-lg shadow-green-100">
                            <Button onClick={() => removeFromCart(p.id)} size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-lg border-none active:scale-90 transition-all">
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="text-white font-black text-sm">{cartItem.quantity}</span>
                            <Button onClick={() => addToCart(p)} size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700 text-white rounded-lg border-none active:scale-90 transition-all">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button onClick={() => addToCart(p)} className="rounded-xl h-10 px-6 font-black text-xs bg-green-500 text-white hover:bg-green-600 uppercase shadow-lg shadow-green-100 active:scale-95 transition-all">
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
              setIsPhoneDialogOpen(true);
            }} className="bg-white text-green-700 hover:bg-slate-50 h-14 px-8 rounded-2xl font-black uppercase text-sm flex items-center gap-2 border-none active:scale-95 transition-all">
              CHECKOUT <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      <Toaster />

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 max-md border-none shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-slate-900">Checkout</DialogTitle>
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
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">Packaging</Label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-4 rounded-2xl border text-left transition-all", packagingType === 'Normal' ? "border-green-500 bg-green-50/50" : "border-slate-100")}>
                  <Package className={cn("w-5 h-5 mb-2", packagingType === 'Normal' ? "text-green-500" : "text-slate-300")} />
                  <p className="text-[11px] font-black uppercase">Normal (Free)</p>
                </button>
                <button onClick={() => setPackagingType('Gift')} className={cn("p-4 rounded-2xl border text-left transition-all", packagingType === 'Gift' ? "border-pink-500 bg-pink-50/50" : "border-slate-100")}>
                  <Gift className={cn("w-5 h-5 mb-2", packagingType === 'Gift' ? "text-pink-500" : "text-slate-300")} />
                  <p className="text-[11px] font-black uppercase">Gift Wrap (+₹40)</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] p-6 space-y-3 border border-slate-100">
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                <span>Subtotal</span>
                <span>₹{cartTotal}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                <span>Delivery & GST</span>
                <span>₹{cartTotal < 100 ? 125 : 25}</span>
              </div>
              <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                <span className="text-lg font-black uppercase text-slate-900">Total</span>
                <span className="text-2xl font-black text-green-600">₹{cartTotal + (cartTotal < 100 ? 125 : 25) + (packagingType === 'Gift' ? 40 : 0)}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-16 rounded-2xl bg-green-500 text-white font-black text-sm uppercase shadow-xl shadow-green-100 border-none hover:bg-green-600 active:scale-95 transition-all">
                <Smartphone className="w-5 h-5 mr-3" /> Pay via UPI
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
          <h3 className="text-xl font-black uppercase mb-6">Scan QR</h3>
          <div className="p-6 bg-white rounded-[2rem] border-4 border-slate-50 shadow-inner mb-6">
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-full aspect-square object-contain" /> : <div className="w-full aspect-square bg-slate-100 flex items-center justify-center"><QrCode className="w-12 h-12 text-slate-300" /></div>}
          </div>
          <p className="text-xs font-black text-slate-900 uppercase mb-8">{settings?.upiId || "N/A"}</p>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-16 rounded-2xl bg-black text-white font-black uppercase text-sm border-none active:scale-95 transition-all shadow-xl">Payment Completed</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-sm text-center border-none shadow-2xl">
          <DialogHeader className="mb-6"><DialogTitle className="text-2xl font-black uppercase text-slate-900">Contact Number</DialogTitle></DialogHeader>
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <Input 
              type="tel" 
              placeholder="9876543210" 
              value={phoneNumber} 
              onChange={(e) => setPhoneNumber(e.target.value)} 
              className="h-16 text-center text-xl font-black rounded-2xl border-slate-100 bg-slate-50 tracking-widest" 
            />
            <Button type="submit" className="w-full h-16 rounded-2xl bg-green-500 text-white font-black uppercase text-sm border-none shadow-xl shadow-green-100">Confirm & Pay</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-xs text-center border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black uppercase text-blue-600">Admin Login</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-6 pt-4">
            <Input 
              maxLength={4} 
              className="text-center text-4xl h-20 font-black rounded-2xl border-slate-100 bg-slate-50 tracking-[0.5em] text-blue-600" 
              value={verificationCode} 
              onChange={(e) => setVerificationCode(e.target.value)} 
            />
            <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm border-none shadow-xl shadow-blue-100">Unlock Hub</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
