
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { Search, ShieldCheck, MessageCircle, ShoppingBag, Loader2, LogOut, LayoutGrid, Clock, Phone, Pin, Smartphone, Wallet, Banknote, PhoneCall, QrCode, MapPin, Gift, Package, Layers } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Bounsi, Bihar (813104) Center Coordinates
const BOUNSI_LAT = 24.8021;
const BOUNSI_LNG = 87.0267;
const MAX_DISTANCE_KM = 9;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
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
  const [userDistance, setUserDistance] = useState<number | null>(null);

  const ADMIN_SECRET_KEY = 'kela123';
  const ADMIN_VERIFICATION_CODE = '5930'; 

  // Location Check Logic
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(BOUNSI_LAT, BOUNSI_LNG, pos.coords.latitude, pos.coords.longitude);
        setUserDistance(dist);
        if (dist <= MAX_DISTANCE_KM) {
          setLocationStatus('allowed');
        } else {
          setLocationStatus('out_of_range');
        }
      },
      () => setLocationStatus('denied')
    );
  }, []);

  // Ensure user is signed in anonymously to interact with Firestore
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const profileRef = useMemoFirebase(() => user ? doc(firestore, 'userProfiles', user.uid) : null, [firestore, user]);
  const { data: profile } = useDoc(profileRef);

  const storeSettingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(storeSettingsRef);

  const WHATSAPP_NUMBER = settings?.whatsappNumber || "917319965930";
  const HELP_LINE_NUMBER = settings?.helpLineNumber || "917319965930";
  const UPI_ID = settings?.upiId || "";
  const UPI_QR_URL = settings?.upiQrUrl || "";

  // Secret Admin Unlock Sequence
  useEffect(() => {
    if (searchQuery.toLowerCase() === ADMIN_SECRET_KEY) {
      setIsVerificationDialogOpen(true);
      setSearchQuery('');
    }
  }, [searchQuery]);

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === ADMIN_VERIFICATION_CODE) {
      if (user) {
        const adminRef = doc(firestore, 'admin_roles', user.uid);
        setDocumentNonBlocking(adminRef, { assignedAt: new Date().toISOString() }, { merge: true });
        setIsVerificationDialogOpen(false);
        setVerificationCode('');
        toast({ title: "Admin Access Granted" });
      }
    } else {
      toast({ title: "Invalid Code", variant: "destructive" });
    }
  };

  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const themeDocRef = useMemoFirebase(() => doc(firestore, 'publicDisplaySettings', 'theme'), [firestore]);
  const { data: themeData } = useDoc(themeDocRef);
  const currentTheme: FestivalTheme = (themeData?.activeThemeName as FestivalTheme) || 'Normal';
  const currentThemeConfig = THEME_DATA[currentTheme];

  // Persistent Admin Check via Firestore
  const adminRoleRef = useMemoFirebase(() => user ? doc(firestore, 'admin_roles', user.uid) : null, [firestore, user]);
  const { data: adminRole } = useDoc(adminRoleRef);
  const isAdmin = !!adminRole;

  const filteredProductsBySection = useMemo(() => {
    if (!products) return {};
    const sorted = [...products].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1));
    const filtered = sorted.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.reduce((acc: any, product: any) => {
      const section = product.section || "General Bazaar";
      if (!acc[section]) acc[section] = [];
      acc[section].push(product);
      return acc;
    }, {});
  }, [products, searchQuery]);

  const calculateTotalPrice = (basePrice: number, qty: number = 1) => {
    const subtotal = basePrice * qty;
    let deliveryGST = subtotal < 100 ? 125 : 25;
    let packagingFee = packagingType === 'Gift' ? 40 : 0;
    return subtotal + deliveryGST + packagingFee;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 10) return toast({ title: "Invalid Number" });
    if (user) {
      setDocumentNonBlocking(doc(firestore, 'userProfiles', user.uid), { phoneNumber }, { merge: true });
      setIsPhoneDialogOpen(false);
      if (selectedProduct) setIsPaymentDialogOpen(true);
    }
  };

  const handleBuyRequest = (product: any) => {
    setSelectedProduct(product);
    setQuantity(1);
    setPackagingType('Normal');
    if (!user || !profile?.phoneNumber) {
      setIsPhoneDialogOpen(true);
      return;
    }
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentChoice = (method: 'COD' | 'UPI') => {
    if (method === 'UPI' && UPI_QR_URL) {
      setIsQrDialogOpen(true);
    } else {
      finalizeOrder(selectedProduct, method);
    }
  };

  const finalizeOrder = async (product: any, method: 'COD' | 'UPI') => {
    const phone = profile?.phoneNumber || phoneNumber;
    const finalPrice = calculateTotalPrice(product.price, quantity);
    const packagingInfo = packagingType === 'Gift' ? "Gift Packaging (₹40)" : "Normal Packaging (Free)";
    const qtyText = (product.unit === 'kg' || product.unit === 'Liter') ? `${quantity} ${product.unit}` : `${quantity} Unit(s)`;
    
    navigator.geolocation.getCurrentPosition((pos) => {
      const locLink = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      const message = `*Bounsi Bazaar Order Alert!*\n\nItem: ${product.name}\nQuantity: ${qtyText}\nBase Price: ₹${product.price} / ${product.unit}\nSubtotal: ₹${product.price * quantity}\nDelivery/GST: ₹${(product.price * quantity) < 100 ? 125 : 25}\nPackaging: ${packagingInfo}\n*Total: ₹${finalPrice}*\n\nPayment: ${method}\nLocation: ${locLink}\nPhone: ${phone}\nSpeed: 30 MIN DELIVERY ⚡`;
      
      addDocumentNonBlocking(collection(firestore, 'orders'), {
        phoneNumber: phone,
        productName: product.name,
        quantity: quantity,
        amount: finalPrice,
        status: 'pending',
        userId: user?.uid,
        createdAt: new Date().toISOString()
      });

      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
      setSelectedProduct(null);
      setIsQrDialogOpen(false);
      setIsPaymentDialogOpen(false);
    });
  };

  if (locationStatus === 'checking' || isProductsLoading || isUserLoading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="w-12 h-12 animate-spin text-primary" />
      <p className="font-bold text-slate-400 uppercase tracking-widest">Checking Location Access...</p>
    </div>;
  }

  if (locationStatus === 'out_of_range' || locationStatus === 'denied') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-10 text-center space-y-6">
        <div className="p-8 rounded-full bg-red-50 text-red-500"><MapPin className="w-20 h-20" /></div>
        <h1 className="text-4xl font-black text-slate-900 uppercase">Service Unavailable</h1>
        <p className="text-xl text-slate-500 max-w-md font-medium">
          {locationStatus === 'denied' 
            ? "Please allow location access to browse Bounsi Bazaar. We only deliver within 9km of 813104."
            : `You are ${userDistance?.toFixed(1)}km away. We currently only deliver within 9km of Bounsi (813104).`}
        </p>
        <Button onClick={() => window.location.reload()} size="lg" className="rounded-full px-10 h-16 text-xl font-bold">RETRY LOCATION</Button>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen relative pb-20 overflow-x-hidden", currentThemeConfig.bg)}>
      <FestiveEffects theme={currentTheme} />
      
      <nav className={cn("sticky top-0 z-50 py-4 glass-nav transition-all duration-1000", currentTheme === 'Normal' ? 'bg-primary' : '')}>
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-8 h-8 text-white animate-bounce" />
            <h1 className={cn("text-3xl font-black italic tracking-tighter uppercase festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>
              {currentThemeConfig.title}
            </h1>
          </div>
          
          <div className="relative w-full md:w-1/2 group">
            <Input placeholder="Search Bazaar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-14 pl-14 rounded-full text-black bg-white/95 shadow-2xl text-lg" />
            <Search className="absolute left-5 top-4.5 text-gray-400 w-6 h-6" />
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-yellow-400 text-black px-4 py-2 rounded-full flex items-center gap-2 font-black text-xs shadow-lg animate-pulse">
              <Clock className="w-4 h-4" /> 30MIN DELIVERY
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => window.open(`tel:${HELP_LINE_NUMBER}`)} className="rounded-full h-12 w-12 text-white bg-white/10 backdrop-blur-md">
              <PhoneCall className="w-6 h-6" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setIsAdminPanelVisible(!isAdminPanelVisible)} className="rounded-full h-14 w-14 text-white bg-white/10 backdrop-blur-md shadow-xl">
                <ShieldCheck className="w-8 h-8" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {isAdmin && isAdminPanelVisible && (
        <div className="bg-white/95 backdrop-blur-2xl py-10 border-b border-blue-200">
          <div className="container mx-auto px-4 mb-8 flex justify-between items-center">
            <h2 className="text-3xl font-black flex items-center gap-3 text-blue-600 uppercase">Admin Hub</h2>
            <Button variant="outline" size="lg" onClick={async () => { await signOut(auth); setIsAdminPanelVisible(false); }} className="rounded-full bg-blue-50 text-blue-600 border-blue-200">
              <LogOut className="w-5 h-5 mr-2" /> <span>Logout</span>
            </Button>
          </div>
          <AdminPanel stats={{orders: 0, earnings: 0}} currentTheme={currentTheme} onResetStats={() => {}} />
        </div>
      )}

      <main className="container mx-auto p-4 md:p-8 mt-8">
        <div className="space-y-20">
          {Object.entries(filteredProductsBySection).map(([sectionName, items]: [string, any]) => (
            <section key={sectionName} className="space-y-8">
              <div className="flex items-center gap-4">
                <div className={cn("p-4 rounded-3xl shadow-xl bg-gradient-to-br", currentThemeConfig.gradient)}><LayoutGrid className="w-6 h-6 text-white" /></div>
                <h2 className={cn("text-4xl font-black uppercase tracking-tighter festive-title bg-gradient-to-r", currentThemeConfig.gradient)}>{sectionName}</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {items.map((p: any) => (
                  <div key={p.id} className="group product-card-premium rounded-[3rem] p-6 relative flex flex-col justify-between border border-white/20 shadow-xl bg-white/90">
                    <div className="relative overflow-hidden rounded-[2.5rem] h-60 mb-6 bg-slate-100">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        {p.isPinned && <Badge className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black"><Pin className="w-3 h-3 mr-1" /> PINNED</Badge>}
                        <div className="flex gap-1">
                          {p.isCodAvailable && <Badge variant="secondary" className="bg-green-100 text-green-700 text-[8px] font-bold">COD</Badge>}
                          {p.isUpiAvailable && <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[8px] font-bold">UPI</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="px-2 mb-6">
                      <h3 className="font-black text-xl uppercase tracking-tighter mb-2">{p.name}</h3>
                      <div className="flex flex-col gap-1">
                        <p className={cn("text-3xl font-black italic", currentThemeConfig.accent)}>₹{p.price} <span className="text-sm text-gray-400 uppercase">/ {p.unit}</span></p>
                        <p className="text-xs font-bold text-slate-400">Smart Pricing Applied</p>
                      </div>
                    </div>
                    <Button onClick={() => handleBuyRequest(p)} className={cn("w-full h-16 rounded-[1.5rem] font-black text-lg uppercase shadow-2xl text-white border-none", currentThemeConfig.gradient)}>
                      ORDER NOW <MessageCircle className="w-6 h-6 ml-2" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Payment Selection Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="rounded-[3rem] p-8 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-blue-600 uppercase">Complete Order</DialogTitle>
            <DialogDescription className="font-bold text-slate-500 uppercase text-xs">Choose details and payment</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Quantity Selector for kg/Liter */}
            {(selectedProduct?.unit === 'kg' || selectedProduct?.unit === 'Liter') && (
              <div className="space-y-3">
                <Label className="font-black text-slate-400 uppercase text-xs tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Select {selectedProduct.unit === 'kg' ? 'Weight' : 'Volume'}
                </Label>
                <Select value={quantity.toString()} onValueChange={(v) => setQuantity(parseInt(v))}>
                  <SelectTrigger className="h-14 rounded-2xl border-2 border-slate-100 font-bold text-lg">
                    <SelectValue placeholder="Choose amount" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={num.toString()} className="font-bold">
                        {num} {selectedProduct.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3">
              <Label className="font-black text-slate-400 uppercase text-xs tracking-widest">Select Packaging</Label>
              <RadioGroup value={packagingType} onValueChange={(v: any) => setPackagingType(v)} className="grid grid-cols-2 gap-4">
                <div className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer", packagingType === 'Normal' ? "border-blue-600 bg-blue-50" : "border-slate-100")}>
                  <RadioGroupItem value="Normal" id="normal" className="hidden" />
                  <Label htmlFor="normal" className="cursor-pointer flex items-center gap-2 font-bold text-slate-700">
                    <Package className="w-5 h-5" /> Normal (Free)
                  </Label>
                </div>
                <div className={cn("flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer", packagingType === 'Gift' ? "border-blue-600 bg-blue-50" : "border-slate-100")}>
                  <RadioGroupItem value="Gift" id="gift" className="hidden" />
                  <Label htmlFor="gift" className="cursor-pointer flex items-center gap-2 font-bold text-slate-700">
                    <Gift className="w-5 h-5 text-pink-500" /> Gift (+₹40)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-slate-50 p-6 rounded-[2rem] space-y-2">
              <div className="flex justify-between text-sm font-bold text-slate-500">
                <span>Subtotal ({quantity} {selectedProduct?.unit})</span>
                <span>₹{selectedProduct?.price * quantity}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-500">
                <span>Delivery & GST</span>
                <span>₹{(selectedProduct?.price * quantity) < 100 ? 125 : 25}</span>
              </div>
              {packagingType === 'Gift' && (
                <div className="flex justify-between text-sm font-bold text-pink-500">
                  <span>Gift Packaging</span>
                  <span>₹40</span>
                </div>
              )}
              <div className="pt-2 border-t flex justify-between text-2xl font-black text-blue-600">
                <span>TOTAL</span>
                <span>₹{calculateTotalPrice(selectedProduct?.price || 0, quantity)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {selectedProduct?.isUpiAvailable && (
                <Button onClick={() => handlePaymentChoice('UPI')} className="h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg uppercase flex justify-between px-8">
                  <div className="flex items-center gap-3"><Smartphone className="w-6 h-6" /> Pay Now (UPI)</div>
                  <Wallet className="w-6 h-6 opacity-40" />
                </Button>
              )}
              {selectedProduct?.isCodAvailable && (
                <Button onClick={() => handlePaymentChoice('COD')} variant="outline" className="h-16 rounded-2xl border-2 border-blue-200 text-blue-600 font-black text-lg uppercase flex justify-between px-8">
                  <div className="flex items-center gap-3"><Banknote className="w-6 h-6" /> Cash on Delivery</div>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UPI QR Dialog */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-center text-blue-600 uppercase">Scan to Pay</DialogTitle>
            <DialogDescription className="text-center font-bold text-blue-600">{UPI_ID}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-6 py-4">
            {UPI_QR_URL ? (
              <img src={UPI_QR_URL} alt="Payment QR" className="w-64 h-64 object-contain rounded-2xl shadow-2xl border-8 border-white" />
            ) : (
              <div className="w-64 h-64 bg-slate-100 rounded-2xl flex items-center justify-center">
                <QrCode className="w-20 h-20 text-slate-300" />
              </div>
            )}
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-tight">Pay ₹{calculateTotalPrice(selectedProduct?.price || 0, quantity)} to finalize your order.</p>
            <Button onClick={() => finalizeOrder(selectedProduct, 'UPI')} className="w-full h-16 rounded-2xl text-xl font-black bg-blue-600 hover:bg-blue-700 text-white uppercase">I Have Paid</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Other Dialogs (Phone, Verification) */}
      <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader><DialogTitle className="text-3xl font-black text-blue-600 uppercase text-center">Your Number</DialogTitle></DialogHeader>
          <form onSubmit={handlePhoneSubmit} className="space-y-6 py-4">
            <Input type="tel" placeholder="Mobile Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-16 text-3xl font-black rounded-2xl text-center border-blue-100" />
            <Button type="submit" className="w-full h-16 rounded-2xl text-xl font-black uppercase bg-blue-600 text-white">Continue Shopping</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVerificationDialogOpen} onOpenChange={setIsVerificationDialogOpen}>
        <DialogContent className="rounded-[3rem] p-10">
          <DialogHeader><DialogTitle className="text-3xl font-black text-blue-600 uppercase text-center">Admin Unlock</DialogTitle></DialogHeader>
          <form onSubmit={handleVerifyCode} className="space-y-8 py-6">
            <Input maxLength={4} placeholder="0000" className="text-center text-5xl h-24 tracking-[0.5em] font-black rounded-[2rem] border-blue-200 text-blue-600" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
            <Button type="submit" className="w-full h-16 rounded-[1.5rem] text-xl font-black bg-blue-600 text-white uppercase">Open Bazaar Controls</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
