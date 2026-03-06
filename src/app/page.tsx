"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, ShoppingBag, Loader2, LogOut, LayoutGrid, Clock, PhoneCall, MapPin, Package, Gift, Layers, ChevronRight, Smartphone, Banknote, QrCode, Pin } from 'lucide-react';
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
  initiateAnonymousSignIn
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

export default function Home() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [packagingType, setPackagingType] = useState<'Normal' | 'Gift'>('Normal');
  const [quantity, setQuantity] = useState<number>(1);
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

  useEffect(() => {
    if (!isUserLoading && !user) initiateAnonymousSignIn(auth);
  }, [user, isUserLoading, auth]);

  const profileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';
  const currentThemeConfig = THEME_DATA[currentTheme];

  const adminRoleRef = useMemoFirebase(() => user ? doc(firestore, 'admin_roles', user.uid) : null, [firestore, user]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isAdmin = !!adminRole;

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

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const filteredProductsBySection = useMemo(() => {
    if (!products) return {};
    const filtered = products
      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    return filtered.reduce((acc: any, p: any) => {
      const s = p.section || "General Bazaar";
      if (!acc[s]) acc[s] = [];
      acc[s].push(p);
      return acc;
    }, {});
  }, [products, searchQuery]);

  const calculateTotalPrice = (basePrice: number, qty: number = 1) => {
    const subtotal = basePrice * qty;
    const deliveryGST = subtotal < 100 ? 125 : 25;
    const packagingFee = packagingType === 'Gift' ? 40 : 0;
    return subtotal + deliveryGST + packagingFee;
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) return toast({ title: "Invalid Number" });
    if (user) {
      setDocumentNonBlocking(doc(firestore, 'userProfiles', user.uid), { phoneNumber }, { merge: true });
      setIsPhoneDialogOpen(false);
      if (selectedProduct) setIsPaymentDialogOpen(true);
    }
  };

  const finalizeOrder = (method: 'COD' | 'UPI') => {
    const phone = profile?.phoneNumber || phoneNumber;
    const finalPrice = calculateTotalPrice(selectedProduct.price, quantity);
    
    navigator.geolocation.getCurrentPosition((pos) => {
      const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      const message = `*BOUNSI BAZAAR ORDER*\n\n*Item:* ${selectedProduct.name}\n*Qty:* ${quantity} ${selectedProduct.unit}\n*Total:* ₹${finalPrice}\n*Payment:* ${method}\n*Packaging:* ${packagingType}\n*Location:* ${locLink}\n*Phone:* ${phone}\n\n_Delivering in 30 mins!_ ⚡`;
      
      addDocumentNonBlocking(collection(firestore, 'orders'), {
        phoneNumber: phone,
        productName: selectedProduct.name,
        quantity,
        amount: finalPrice,
        status: 'pending',
        userId: user?.uid,
        createdAt: new Date().toISOString()
      });

      window.open(`https://wa.me/${settings?.whatsappNumber || "917319965930"}?text=${encodeURIComponent(message)}`, '_blank');
      setIsQrDialogOpen(false);
      setIsPaymentDialogOpen(false);
    });
  };

  if (locationStatus === 'checking' || isProductsLoading || isUserLoading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-green-500" />
      <p className="font-bold text-slate-400 text-xs tracking-widest uppercase">Opening Bounsi Bazaar...</p>
    </div>;
  }

  if (locationStatus === 'out_of_range' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 text-center gap-6">
        <MapPin className="w-16 h-16 text-red-500" />
        <h1 className="text-3xl font-black text-slate-900 uppercase">Service Not Available</h1>
        <p className="text-slate-500 max-w-xs font-medium">We deliver within 9km of Bounsi (813104). Please enable location to browse the bazaar.</p>
        <Button onClick={() => window.location.reload()} size="lg" className="rounded-full px-10 h-14 bg-black text-white font-bold">RETRY</Button>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-20", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className="sticky top-0 z-50 glass-nav">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className={cn("text-xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>
              {currentThemeConfig.title}
            </h1>
          </div>
          
          <div className="relative flex-1 max-w-md hidden md:block">
            <Input placeholder="Search milk, ghee, groceries..." value={searchQuery} onChange={setSearchQuery} className="w-full h-11 pl-10 rounded-xl bg-slate-50 border-none shadow-inner" />
            <Search className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-700 px-3 py-1 rounded-lg border-none font-bold text-[10px] hidden sm:flex items-center gap-1">
              <Clock className="w-3 h-3" /> 30 MIN
            </Badge>
            <Button variant="outline" size="icon" onClick={() => window.open(`tel:${settings?.helpLineNumber || "917319965930"}`)} className="rounded-xl h-10 w-10 border-slate-200">
              <PhoneCall className="w-4 h-4 text-slate-600" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)} className="rounded-xl h-10 w-10 bg-blue-50">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </Button>
            )}
          </div>
        </div>
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Input placeholder="Search groceries..." value={searchQuery} onChange={setSearchQuery} className="w-full h-11 pl-10 rounded-xl bg-slate-50 border-none" />
            <Search className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
          </div>
        </div>
      </nav>

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-white py-8 border-b animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="container mx-auto px-4 flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-blue-600 uppercase flex items-center gap-2">
              <Layers className="w-5 h-5" /> Admin Hub
            </h2>
            <Button variant="outline" size="sm" onClick={() => signOut(auth)} className="rounded-lg text-blue-600 border-blue-200">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
          <AdminPanel stats={{orders: 0, earnings: 0}} currentTheme={currentTheme} onResetStats={() => {}} />
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-12">
          {Object.entries(filteredProductsBySection).map(([section, items]: [string, any]) => (
            <section key={section} className="space-y-4">
              <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-green-500" /> {section}
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {items.map((p: any) => (
                  <div key={p.id} className="group product-card-blinkit rounded-2xl p-3 flex flex-col h-full">
                    <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-slate-50">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      {p.isPinned && (
                        <div className="absolute top-2 left-2 bg-yellow-400 text-black px-1.5 py-0.5 rounded text-[8px] font-black flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5" /> PINNED
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <h3 className="font-bold text-xs text-slate-800 line-clamp-2 uppercase">{p.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{p.unit === 'kg' || p.unit === 'Liter' ? `1 ${p.unit}` : p.unit}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">₹{p.price}</span>
                      <Button onClick={() => {
                        setSelectedProduct(p);
                        setQuantity(1);
                        setPackagingType('Normal');
                        if (!user || !profile?.phoneNumber) setIsPhoneDialogOpen(true);
                        else setIsPaymentDialogOpen(true);
                      }} size="sm" className="rounded-lg h-8 px-4 font-black text-[10px] bg-green-500 text-white hover:bg-green-600 uppercase">
                        ADD
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-3xl p-6 max-w-sm border-none shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Checkout</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {(selectedProduct?.unit === 'kg' || selectedProduct?.unit === 'Liter') && (
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-slate-400">Select Amount</Label>
                <Select value={quantity.toString()} onValueChange={(v) => setQuantity(parseInt(v))}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()} className="font-bold">{n} {selectedProduct.unit}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-slate-400">Packaging</Label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPackagingType('Normal')} className={cn("p-3 rounded-xl border text-left transition-all", packagingType === 'Normal' ? "border-green-500 bg-green-50/50" : "border-slate-100")}>
                  <Package className={cn("w-4 h-4 mb-1", packagingType === 'Normal' ? "text-green-500" : "text-slate-300")} />
                  <p className="text-[10px] font-black uppercase">Standard (Free)</p>
                </button>
                <button onClick={() => setPackagingType('Gift')} className={cn("p-3 rounded-xl border text-left transition-all", packagingType === 'Gift' ? "border-pink-500 bg-pink-50/50" : "border-slate-100")}>
                  <Gift className={cn("w-4 h-4 mb-1", packagingType === 'Gift' ? "text-pink-500" : "text-slate-300")} />
                  <p className="text-[10px] font-black uppercase">Gift Box (+₹40)</p>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                <span>Items Subtotal</span>
                <span>₹{selectedProduct?.price * quantity}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                <span>Delivery & GST Fee</span>
                <span>₹{(selectedProduct?.price * quantity) < 100 ? 125 : 25}</span>
              </div>
              {packagingType === 'Gift' && (
                <div className="flex justify-between text-[10px] font-bold text-pink-500 uppercase">
                  <span>Gift Wrapping</span>
                  <span>₹40</span>
                </div>
              )}
              <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between items-center">
                <span className="text-sm font-black uppercase">To Pay</span>
                <span className="text-lg font-black text-green-600">₹{calculateTotalPrice(selectedProduct?.price || 0, quantity)}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button onClick={() => { if(settings?.upiQrUrl) setIsQrDialogOpen(true); else finalizeOrder('UPI'); }} className="h-12 rounded-xl bg-green-500 text-white font-black text-xs uppercase shadow-lg shadow-green-100">
                <Smartphone className="w-4 h-4 mr-2" /> Pay via UPI
              </Button>
              <Button onClick={() => finalizeOrder('COD')} variant="outline" className="h-12 rounded-xl border-slate-200 text-slate-600 font-black text-xs uppercase">
                <Banknote className="w-4 h-4 mr-2" /> Cash on Delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-xs text-center">
          <h3 className="text-lg font-black uppercase mb-4">Scan QR to Pay</h3>
          <div className="p-4 bg-white rounded-2xl border-4 border-slate-50 shadow-inner mb-4">
            {settings?.upiQrUrl ? <img src={settings.upiQrUrl} className="w-48 h-48 mx-auto" /> : <div className="w-48 h-48 bg-slate-100 flex items-center justify-center"><QrCode className="w-10 h-10 text-slate-300" /></div>}
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-6">UPI ID: {settings?.upiId || "No UPI ID set"}</p>
          <Button onClick={() => finalizeOrder('UPI')} className="w-full h-12 rounded-xl bg-black text-white font-black uppercase text-xs">I Have Completed Payment</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-sm text-center">
          <DialogHeader className="mb-4"><DialogTitle className="text-xl font-black uppercase">Verify Phone</DialogTitle></DialogHeader>
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <Input type="tel" placeholder="Mobile Number" value={phoneNumber} onChange={setPhoneNumber} className="h-12 text-center text-lg font-bold rounded-xl border-slate-100" />
            <Button type="submit" className="w-full h-12 rounded-xl bg-green-500 text-white font-black uppercase">Continue</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-3xl p-8 max-w-xs text-center">
          <DialogHeader><DialogTitle className="text-lg font-black uppercase">Admin Verification</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-4 pt-2">
            <Input maxLength={4} className="text-center text-3xl h-16 font-black rounded-xl border-slate-100" value={verificationCode} onChange={setVerificationCode} />
            <Button type="submit" className="w-full h-12 rounded-xl bg-blue-600 text-white font-black uppercase">Verify & Unlock</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
