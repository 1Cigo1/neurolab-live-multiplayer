
# NeuroLab Live

Socket.IO tabanlı gerçek zamanlı çok oyunculu yapay sinir ağı eğitim simülatörü.

## Özellikler

- Kullanıcı adı girme
- Oda oluşturma / odaya katılma
- Odadaki kullanıcıları gösterme
- Chat
- XOR yapay sinir ağı simülasyonu
- Eğit butonu
- Eğitim sonucunu herkese gönderme
- Tahmin tablosu
- Loss değeri
- Loss grafiği
- Neural network animasyonu
- Öğretmen rolü
- Sadece öğretmen eğitebilir modu
- Quiz bölümü
- Eğitim geçmişi
- Oda kodu kopyalama
- Öğretici mod kartları

## Kurulum

```bash
npm run install:all
npm run dev
```

Alternatif olarak iki terminal aç:

```bash
cd server
npm install
npm run dev
```

```bash
cd client
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000

## Kullanım

1. Bir tarayıcıda kullanıcı adı gir ve Öğretmen rolüyle oda oluştur.
2. Oda kodunu kopyala.
3. Başka bir sekmede Öğrenci rolüyle aynı odaya katıl.
4. Öğretmen Eğit butonuna basınca sonuçlar tüm kullanıcılara canlı gider.
