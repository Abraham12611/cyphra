import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useCurrentAccount } from '@mysten/dapp-kit';
import {
  HiOutlineDatabase,
  HiOutlineShieldCheck,
  HiOutlineCurrencyDollar,
  HiArrowRight,
  HiCheckCircle,
  HiSparkles,
  HiOutlineLightningBolt,
  HiOutlineGlobeAlt,
} from 'react-icons/hi';
import { ConnectButton } from '@mysten/dapp-kit';

const Login = () => {
  const account = useCurrentAccount();
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (account) {
      setShowSuccess(true);

      const timer = setTimeout(() => {
        router.push('/home');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [account, router]);

  const handleGoToHome = () => {
    router.push('/home');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen h-screen px-6 relative overflow-hidden">
      {/* Modern Abstract Background */}
      <div className="absolute inset-0 bg-[#0a0a0f] z-0"></div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Animated Gradient Orbs */}
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>

        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <div key={i} className={`particle particle-${i + 1}`}></div>
        ))}

        {/* Geometric Elements */}
        <div className="geometric geo-1"></div>
        <div className="geometric geo-2"></div>
        <div className="geometric geo-3"></div>
        <div className="geometric geo-4"></div>

        {/* Animated Lines */}
        <div className="line line-1"></div>
        <div className="line line-2"></div>
        <div className="line line-3"></div>

        {/* Subtle Grid Overlay */}
        <div className="absolute inset-0 bg-grid opacity-5"></div>
      </div>

      {/* Content */}
      <div className="max-w-md w-full text-center space-y-8 relative z-10 my-auto border border-gray-700 rounded-2xl p-4 backdrop-blur-xl">
        {/* Logo and title */}
        <div className="space-y-6 mb-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-[#6366f1] to-[#a855f7] blur-3xl opacity-40 animate-pulse"></div>
            {/* <div className="relative bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#6366f1] p-4 rounded-2xl shadow-2xl">
              <HiOutlineGlobeAlt className="w-16 h-16 text-white" />
            </div> */}
          </div>
          <div>
            <h1 className="text-5xl font-bold text-white mb-3 relative">
              Welcome to Hyvve
            </h1>
          </div>
        </div>

        {/* Features - Redesigned */}
        <div className="grid grid-cols-3 gap-4 my-8">
          {[
            {
              icon: HiOutlineDatabase,
              label: 'Contribute Data',
              color: 'from-[#6366f1] to-[#4f46e5]',
            },
            {
              icon: HiOutlineShieldCheck,
              label: 'Verify Quality',
              color: 'from-[#a855f7] to-[#9333ea]',
            },
            {
              icon: HiOutlineCurrencyDollar,
              label: 'Earn Rewards',
              color: 'from-[#8b5cf6] to-[#7c3aed]',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="group relative bg-gradient-to-br from-[#1a1a1f]/80 to-[#16161b]/80 backdrop-blur-xl border border-[#f5f5fa14] rounded-2xl p-4 transition-all duration-500 hover:scale-105 hover:border-[#a855f7]/50 hover:shadow-lg hover:shadow-[#a855f7]/20"
            >
              <div
                className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${
                    feature.color.split(' ')[1]
                  }, ${feature.color.split(' ')[3]})`,
                }}
              ></div>
              <div
                className={`relative w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-500`}
              >
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-[#f5f5faf4] text-sm font-medium">
                {feature.label}
              </p>
            </div>
          ))}
        </div>

        {/* Wallet connection card or Success message - Redesigned */}
        {showSuccess ? (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/30 to-emerald-500/30 blur-3xl"></div>
            <div className="relative bg-gradient-to-br from-[#0f0f13]/90 to-[#16161b]/90 backdrop-blur-2xl border border-green-500/50 rounded-3xl p-8 shadow-2xl transform hover:scale-[1.02] transition-all duration-500">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500 blur-xl opacity-50 animate-pulse"></div>
                  <HiCheckCircle className="relative w-16 h-16 text-green-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Successfully Connected!
              </h2>
              <p className="text-[#f5f5fa7a] text-sm mb-6">
                Your wallet is now connected. Redirecting...
              </p>
              <button
                onClick={handleGoToHome}
                className="group w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-green-500/30 transition-all duration-300 hover:scale-[1.02]"
              >
                Go to Home
                <HiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#6366f1]/20 to-[#a855f7]/20 blur-3xl animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-[#16161b]/60 to-[#1a1a1f]/60 backdrop-blur-2xl border border-[#a855f7]/30 rounded-3xl p-8 shadow-2xl transform hover:scale-[1.02] transition-all duration-500">
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <HiSparkles className="w-6 h-6 text-[#a855f7]" />
                  <h2 className="text-2xl font-bold text-white">
                    Connect Your Wallet
                  </h2>
                  <HiSparkles className="w-6 h-6 text-[#6366f1]" />
                </div>
                <p className="text-[#f5f5fa7a] text-sm leading-relaxed">
                  Join the revolution in decentralized, token-incentivized data
                  collection.
                  <br />
                </p>
              </div>

              <div className="relative group">
                <ConnectButton />
              </div>

              <div className="mt-6 flex items-center justify-center gap-4 text-[#f5f5fa4a] text-xs">
                <div className="flex items-center gap-1">
                  <HiOutlineLightningBolt className="w-3 h-3" />
                  <span>Instant Access</span>
                </div>
                <div className="w-1 h-1 bg-[#f5f5fa4a] rounded-full"></div>
                <div className="flex items-center gap-1">
                  <HiOutlineShieldCheck className="w-3 h-3" />
                  <span>Secure & Private</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="text-[#f5f5fa4a] text-xs mt-6 leading-relaxed">
          By connecting, you agree to our{' '}
          <a
            href="#"
            className="text-[#a855f7] hover:text-[#6366f1] transition-colors hover:underline"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="#"
            className="text-[#a855f7] hover:text-[#6366f1] transition-colors hover:underline"
          >
            Privacy Policy
          </a>
        </p>
      </div>

      {/* Enhanced CSS for modern animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-20px) scale(1.02);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        @keyframes gradient {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }

        @keyframes rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes drift {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }

        @keyframes particle-float {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes line-flow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 4s ease infinite;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.4;
          animation: pulse 15s ease-in-out infinite,
            drift 60s ease-in-out infinite;
        }

        .orb-1 {
          width: 600px;
          height: 600px;
          top: -20%;
          left: -10%;
          background: radial-gradient(
            circle at center,
            rgba(99, 102, 241, 0.4),
            transparent
          );
          animation-delay: 0s;
        }

        .orb-2 {
          width: 500px;
          height: 500px;
          bottom: -20%;
          right: -10%;
          background: radial-gradient(
            circle at center,
            rgba(168, 85, 247, 0.4),
            transparent
          );
          animation-delay: 5s;
        }

        .orb-3 {
          width: 400px;
          height: 400px;
          top: 50%;
          left: 50%;
          background: radial-gradient(
            circle at center,
            rgba(139, 92, 246, 0.3),
            transparent
          );
          animation-delay: 10s;
        }

        .orb-4 {
          width: 300px;
          height: 300px;
          bottom: 20%;
          left: 10%;
          background: radial-gradient(
            circle at center,
            rgba(99, 102, 241, 0.3),
            transparent
          );
          animation-delay: 15s;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          border-radius: 50%;
          animation: particle-float 20s linear infinite;
        }

        ${[...Array(20)]
          .map(
            (_, i) => `
          .particle-${i + 1} {
            left: ${Math.random() * 100}%;
            animation-delay: ${Math.random() * 20}s;
            animation-duration: ${15 + Math.random() * 10}s;
          }
        `
          )
          .join('')}

        .geometric {
          position: absolute;
          opacity: 0.1;
          animation: rotate 120s linear infinite;
          border: 1px solid;
        }

        .geo-1 {
          top: 10%;
          left: 10%;
          width: 200px;
          height: 200px;
          border-color: rgba(168, 85, 247, 0.3);
          border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
        }

        .geo-2 {
          bottom: 20%;
          right: 15%;
          width: 150px;
          height: 150px;
          border-color: rgba(99, 102, 241, 0.3);
          border-radius: 50% 50% 50% 50% / 60% 40% 60% 40%;
          animation-direction: reverse;
        }

        .geo-3 {
          top: 40%;
          right: 25%;
          width: 100px;
          height: 100px;
          border-color: rgba(139, 92, 246, 0.3);
          transform: rotate(45deg);
        }

        .geo-4 {
          bottom: 30%;
          left: 20%;
          width: 120px;
          height: 120px;
          border-color: rgba(168, 85, 247, 0.3);
          border-radius: 30% 70% 50% 50% / 40% 60% 40% 60%;
          animation-duration: 80s;
        }

        .line {
          position: absolute;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(168, 85, 247, 0.5),
            transparent
          );
          animation: line-flow 8s linear infinite;
        }

        .line-1 {
          top: 20%;
          width: 300px;
          left: -300px;
        }

        .line-2 {
          top: 50%;
          width: 400px;
          right: -400px;
          animation-delay: 3s;
          animation-direction: reverse;
        }

        .line-3 {
          bottom: 30%;
          width: 250px;
          left: -250px;
          animation-delay: 6s;
        }

        .bg-grid {
          background-image: linear-gradient(
              rgba(99, 102, 241, 0.1) 1px,
              transparent 1px
            ),
            linear-gradient(90deg, rgba(168, 85, 247, 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
};

export default Login;
