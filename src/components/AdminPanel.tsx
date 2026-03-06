
"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FestivalTheme, THEME_DATA } from '@/app/lib/constants';
import { Sparkles, Plus, Trash2, ChartBar, Palette, PackagePlus, Scale, LayoutGrid, DatabaseBackup } from 'lucide-react';
import { generateProductDescription } from '@/ai/flows/admin-ai-product-description';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';

interface AdminPanelProps {
  stats: { orders: number; earnings: number };
  currentTheme: FestivalTheme;
  onResetStats: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ stats, currentTheme, onResetStats }) => {
  const firestore = useFirestore();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Food');
  const [unit, setUnit] = useState('kg');
  const [section, setSection] = useState('General Bazaar');
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!name || !price || !imageUrl || !section) {
      toast({ title: "Error", description: "Please fill name, price, section and image URL", variant: "destructive" });
      return;
    }

    const productsRef = collection(firestore, 'products');
    addDocumentNonBlocking(productsRef, {
      name,
      price: parseFloat(price),
      unit,
      section,
      category,
      imageUrl,
      description: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    setName('');
    setPrice('');
    setImageUrl('');
    toast({ title: "Success", description: `Added ${name} to ${section}!` });
  };

  const seedData = () => {
    const samples = [
      { name: "Kaju Katli", price: 800, unit: "kg", section: "Sweets Corner", category: "Food", img: "https://picsum.photos/seed/kaju/400/400" },
      { name: "Eco Diya Set", price: 150, unit: "Pcs", section: "Festive Decor", category: "Festive", img: "https://picsum.photos/seed/diya/400/400" },
      { name: "Pure Cow Ghee", price: 650, unit: "Liter", section: "Dairy Fresh", category: "Food", img: "https://picsum.photos/seed/ghee/400/400" },
      { name: "Cotton Kurta", price: 1200, unit: "Pcs", section: "Fashion Hub", category: "Fashion", img: "https://picsum.photos/seed/kurta/400/400" }
    ];

    const productsRef = collection(firestore, 'products');
    samples.forEach(s => {
      addDocumentNonBlocking(productsRef, {
        ...s,
        imageUrl: s.img,
        description: "Fresh and premium quality products from Bounsi Bazaar.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    toast({ title: "Database Seeded", description: "Sample products added to your bazaar!" });
  };

  const setTheme = (theme: FestivalTheme) => {
    const mainSettingsRef = doc(firestore, 'storeSettings', 'mainSettings');
    const publicThemeRef = doc(firestore, 'publicDisplaySettings', 'theme');

    setDocumentNonBlocking(mainSettingsRef, { activeThemeName: theme, lastUpdated: new Date().toISOString() }, { merge: true });
    setDocumentNonBlocking(publicThemeRef, { activeThemeName: theme }, { merge: true });

    toast({ title: "Theme Updated", description: `Active theme changed to ${theme}` });
  };

  const generateAI = async () => {
    if (!name) {
      toast({ title: "Error", description: "Enter a product name first", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateProductDescription({ productName: name, keywords: [category, 'Quality', unit] });
      toast({ title: "AI Generated", description: "Description: " + result.description });
    } catch (err) {
      toast({ title: "Error", description: "AI failed to generate description", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary text-primary-foreground border-none shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase opacity-70 flex items-center gap-2">
              <ChartBar className="w-4 h-4" /> Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black">{stats.orders}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-600 text-white border-none shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase opacity-70 flex items-center gap-2">
              <PackagePlus className="w-4 h-4" /> Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black">₹{stats.earnings.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-secondary text-secondary-foreground border-none shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase opacity-70 flex items-center gap-2">
              <Palette className="w-4 h-4" /> Active Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black">{currentTheme.toUpperCase()}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button 
          variant="outline" 
          onClick={seedData} 
          className="rounded-2xl h-12 border-dashed border-2 hover:bg-primary/5 flex items-center gap-2 px-6"
        >
          <DatabaseBackup className="w-5 h-5 text-primary" /> Seed Sample Products
        </Button>
      </div>

      <Card className="rounded-[2.5rem] shadow-2xl border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700">
            <Palette className="w-6 h-6" /> FESTIVAL MODE
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {(Object.keys(THEME_DATA) as FestivalTheme[]).map((t) => (
            <Button
              key={t}
              variant={currentTheme === t ? 'default' : 'outline'}
              onClick={() => setTheme(t)}
              className="rounded-2xl font-bold px-6 h-12"
            >
              {t === 'Normal' ? 'Default' : t}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-[2.5rem] shadow-2xl border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700">
            <Plus className="w-6 h-6" /> ADD NEW ITEM
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kaju Katli" className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="rounded-xl h-12" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Scale className="w-4 h-4" /> Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gm">gm</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="Liter">Liter</SelectItem>
                  <SelectItem value="Pcs">Pcs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> Store Section</Label>
              <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Sweets Corner" className="rounded-xl h-12" />
              <p className="text-[10px] text-muted-foreground">Type a new name to create a new section.</p>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Food">🍔 Food</SelectItem>
                  <SelectItem value="Electronic">🔌 Electronic</SelectItem>
                  <SelectItem value="Fashion">👕 Fashion</SelectItem>
                  <SelectItem value="Festive">✨ Festive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl h-12" />
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 pt-4">
            <Button onClick={handleAdd} className="flex-1 rounded-2xl h-14 font-black text-lg">
              ADD ITEM TO STORE
            </Button>
            <Button 
              onClick={generateAI} 
              disabled={isGenerating} 
              variant="outline" 
              className="rounded-2xl h-14 border-primary text-primary hover:bg-primary/5 flex items-center gap-2 px-8"
            >
              <Sparkles className="w-5 h-5" /> {isGenerating ? 'AI Generating...' : 'AI Description'}
            </Button>
          </div>
          <button 
            onClick={() => { if(confirm("Clear stats?")) onResetStats() }}
            className="text-destructive text-xs font-bold uppercase hover:underline flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Reset Store Stats
          </button>
        </CardContent>
      </Card>
    </div>
  );
};
