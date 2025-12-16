import { ArrowRight, Leaf } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 35px,
            rgba(255, 255, 255, 0.1) 35px,
            rgba(255, 255, 255, 0.1) 37px
          )`,
          }}
        ></div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 35px,
            rgba(255, 255, 255, 0.05) 35px,
            rgba(255, 255, 255, 0.05) 37px
          )`,
          }}
        ></div>
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-gray-900 via-black to-gray-800 opacity-90"></div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-6 py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Leaf className="w-5 h-5 text-black" />
              </div>
              <span className="text-xl font-bold">Flora&Fauna</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#about"
                className="text-gray-300 hover:text-white transition-colors"
              >
                About us
              </a>
              <a
                href="#pricing"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Pricing
              </a>
              <a
                href="#contact"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Contact us
              </a>
              <a
                href="#blog"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Blog
              </a>
            </div>

            <a
              href="/login"
              className="flex items-center gap-2 px-6 py-2.5 border border-white rounded-full hover:bg-white hover:text-black transition-all duration-300"
            >
              Login
              <ArrowRight className="w-4 h-4" />
            </a>
          </nav>
        </header>

        {/* Hero Section */}
        <main className="container mx-auto px-6 pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
              Energizing a<br />
              <span className="text-gray-300">Green Future</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              Our commitment to green energy is paving the way for a cleaner,
              healthier planet. Join us on a journey towards a future where
              clean, renewable energy sources transform the way we power our
              lives.
            </p>

            <button className="bg-white text-black px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-200 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105">
              See our solutions
            </button>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-1/4 left-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl"></div>
        </main>
      </div>
    </div>
  );
}
