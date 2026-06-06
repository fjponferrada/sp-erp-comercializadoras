import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id:           string;
      name:         string;
      email:        string;
      role:         string;         // SUPERADMIN | COMPANYADMIN | BACKOFFICE | CANAL
      brandId:      string;
      brandName:    string;
      companyId:    string;
      // Colores de la marca (para el BrandThemeProvider)
      accentColor:  string;
      bgColor:      string;
      surfaceColor: string;
      borderColor:  string;
      logoUrl:      string | null;
    };
  }
}
