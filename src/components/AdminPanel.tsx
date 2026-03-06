
"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, addDocumentNonBlocking, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Palette, PlusCircle, Phone, MessageCircle, Wallet, QrCode } from 'lucide-react';

interface AdminPanelProps {
  stats: { orders: number; earnings: number; upiId?: string; upiQrUrl?: string };
  currentTheme: FestivalTheme;
  onResetStats: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats, currentTheme }) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Food');
  const [unit, setUnit] = useState('kg');
  const [section, setSection] = useState('General Bazaar');
  const [imageUrl, setImageUrl] = useState('');
  const [isCodAvailable, setIsCodAvailable] = useState(true);
  const [isUpiAvailable, setIsUpiAvailable] = useState(true);
  const [isPinned, setIsPinned] = useState(false);

  // Store Settings state
  const [whatsapp, setWhatsapp] = useState('');
  const [helpline, setHelpline] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrUrl, setUpiQrUrl] = useState('');

  const settingsRef = useMemoFirebase(() => doc(firestore, 'storeSettings', 'mainSettings'), [firestore]);
  const { data: settings } = useDoc(settingsRef);

  useEffect(() => {
    if (settings) {
      setWhatsapp(settings.whatsappNumber || '');
      setHelpline(settings.helpLineNumber || '');
      setUpiId(settings.upiId || '');
      setUpiQrUrl(settings.upiQrUrl || '');
    }
  }, [settings]);

  const handleUpdateTheme = (newTheme: FestivalTheme) => {
    const themeRef = doc(firestore, 'publicDisplaySettings', 'theme');
    setDocumentNonBlocking(themeRef, { activeThemeName: newTheme }, { merge: true });
    toast({ 
      title: "Bazaar Updated!", 
      description: `The theme is now set to ${newTheme} for all users.`,
    });
  };

  const handleUpdateSettings = () => {
    setDocumentNonBlocking(settingsRef, { 
      whatsappNumber: whatsapp, 
      helpLineNumber: helpline,
      upiId: upiId,
      upiQrUrl: upiQrUrl,
      lastUpdated: new Date().toISOString()
    }, { merge: true });
    toast({ title: "Settings Saved", description: "Bazaar configurations updated successfully." });
  };

  const handleAdd = async () => {
    if (!name || !price || !imageUrl) return toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
    
    addDocumentNonBlocking(collection(firestore, 'products'), {
      name, 
      price: parseFloat(price), 
      unit, 
      section, 
      category, 
      imageUrl, 
      isCodAvailable, 
      isUpiAvailable, 
      isPinned, 
      createdAt: new Date().toISOString()
    });
    
    setName(''); 
    setPrice(''); 
    setImageUrl('');
    toast({ title: "Product Added", description: `${name} is now live in the Bazaar!` });
  };

  return (
    <div className="container mx-auto p-4 space-y-8 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Theme & Store Settings */}
        <div className="space-y-8">
          <Card className="rounded-[2.5rem] shadow-2xl border-none bg-white/90 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-black flex items-center gap-2 text-blue-600">
                <Palette className="w-6 h-6" /> GLOBAL THEME
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(THEME_DATA) as FestivalTheme[]).map((theme) => (
                  <Button 
                    key={theme}
                    onClick={() => handleUpdateTheme(theme)}
                    variant={currentTheme === theme ? "default" : "outline"}
                    className={`rounded-2xl h-14 font-bold ${currentTheme === theme ? 'bg-blue-600 text-white' : 'bg-transparent text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                  >
                    {theme}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] shadow-2xl border-none bg-white/90 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="font-black flex items-center gap-2 text-blue-600">
                <Wallet className="w-6 h-6" /> BAZAAR CONFIG
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">WhatsApp Number</Label>
                <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="e.g. 917319965930" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">Help Line Number</Label>
                <Input value={helpline} onChange={(e) => setHelpline(e.target.value)} placeholder="e.g. 917319965930" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">UPI ID</Label>
                <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="e.g. bazaar@upi" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">UPI QR URL</Label>
                <Input value={upiQrUrl} onChange={(e) => setUpiQrUrl(e.target.value)} placeholder="Paste image link for QR" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <Button onClick={handleUpdateSettings} className="w-full h-12 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700">
                SAVE ALL SETTINGS
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Product Add Section */}
        <Card className="rounded-[2.5rem] shadow-2xl border-none lg:col-span-2 bg-white/90">
          <CardHeader>
            <CardTitle className="text-blue-600 font-black flex items-center gap-2">
              <PlusCircle className="w-6 h-6" /> ADD NEW ITEM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">Product Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Kaju Katli" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">Price (₹)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price in Rupees" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">Store Section</Label>
                <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Sweets Corner" className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">Image URL</Label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl h-12 bg-blue-50 border-none text-blue-900 placeholder:text-blue-300" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-blue-600">Unit Type</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-12 rounded-xl bg-blue-50 border-none text-blue-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gm" className="text-blue-600">gm</SelectItem>
                    <SelectItem value="kg" className="text-blue-600">kg</SelectItem>
                    <SelectItem value="Liter" className="text-blue-600">Liter</SelectItem>
                    <SelectItem value="Pcs" className="text-blue-600">Pcs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-6 py-2">
              <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-2xl">
                <Checkbox id="cod" checked={isCodAvailable} onCheckedChange={(v) => setIsCodAvailable(v === true)} />
                <Label htmlFor="cod" className="cursor-pointer font-bold text-blue-600">Enable COD</Label>
              </div>
              <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-2xl">
                <Checkbox id="upi" checked={isUpiAvailable} onCheckedChange={(v) => setIsUpiAvailable(v === true)} />
                <Label htmlFor="upi" className="cursor-pointer font-bold text-blue-600">Enable UPI</Label>
              </div>
              <div className="flex items-center gap-3 bg-blue-100 p-3 rounded-2xl border border-blue-300">
                <Checkbox id="pin" checked={isPinned} onCheckedChange={(v) => setIsPinned(v === true)} />
                <Label htmlFor="pin" className="cursor-pointer font-black text-blue-700">Pin to Top</Label>
              </div>
            </div>

            <Button onClick={handleAdd} className="w-full h-16 rounded-[1.5rem] bg-blue-600 text-white font-black text-xl shadow-xl hover:bg-blue-700 hover:scale-[1.02] transition-transform">
              PUBLISH TO BAZAAR
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
