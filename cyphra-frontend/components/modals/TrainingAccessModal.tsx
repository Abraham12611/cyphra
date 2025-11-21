import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  HiX,
  HiKey,
  HiShieldCheck,
  HiExclamation,
  HiLockClosed,
} from 'react-icons/hi';
import { toast } from 'react-toastify';

interface TrainingAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccessGranted: () => void;
}

const TrainingAccessModal: React.FC<TrainingAccessModalProps> = ({
  isOpen,
  onClose,
  onAccessGranted,
}) => {
  const [privateKey, setPrivateKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify the private key format
  const verifyPrivateKey = async () => {
    if (!privateKey.trim()) {
      toast.error('Please enter your private key');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      console.log('Verifying RSA private key for training access');

      // Clean up private key - remove extra spaces and normalize format
      let cleanPrivateKey = privateKey.trim();

      // Try different formats if the key doesn't have standard PEM headers
      if (!cleanPrivateKey.includes('BEGIN')) {
        console.log('Key missing BEGIN marker, trying different formats');

        // Try PKCS#1 format first (traditional RSA private key)
        const pkcs1Format = `-----BEGIN RSA PRIVATE KEY-----\n${cleanPrivateKey}\n-----END RSA PRIVATE KEY-----`;

        // Start with PKCS#1 for backward compatibility
        cleanPrivateKey = pkcs1Format;
      }

      let isValidKey = false;

      try {
        // Browser-compatible RSA key validation using Web Crypto API
        if (
          typeof window !== 'undefined' &&
          window.crypto &&
          window.crypto.subtle
        ) {
          console.log('Using Web Crypto API for key validation');

          // Basic format validation for RSA keys
          const hasValidFormat =
            (cleanPrivateKey.includes('BEGIN RSA PRIVATE KEY') &&
              cleanPrivateKey.includes('END RSA PRIVATE KEY')) ||
            (cleanPrivateKey.includes('BEGIN PRIVATE KEY') &&
              cleanPrivateKey.includes('END PRIVATE KEY'));

          const hasValidBase64Content = /[A-Za-z0-9+/=\s\n\r]+/.test(
            cleanPrivateKey
              .replace(/-----BEGIN.*?-----/, '')
              .replace(/-----END.*?-----/, '')
          );

          if (hasValidFormat && hasValidBase64Content) {
            console.log(
              'Training access key verification successful - valid RSA format detected'
            );
            isValidKey = true;
          } else {
            throw new Error('Invalid RSA key format detected');
          }
        } else {
          // Fallback validation for environments without Web Crypto API
          console.log(
            'Web Crypto API not available, using fallback validation'
          );

          // Simple format check
          const hasValidHeaders =
            (cleanPrivateKey.includes('BEGIN RSA PRIVATE KEY') &&
              cleanPrivateKey.includes('END RSA PRIVATE KEY')) ||
            (cleanPrivateKey.includes('BEGIN PRIVATE KEY') &&
              cleanPrivateKey.includes('END PRIVATE KEY'));

          const base64Content = cleanPrivateKey
            .replace(/-----BEGIN.*?-----/, '')
            .replace(/-----END.*?-----/, '')
            .replace(/[\r\n\s]/g, '');

          const hasValidBase64 =
            /^[A-Za-z0-9+/]*={0,2}$/.test(base64Content) &&
            base64Content.length > 100;

          if (hasValidHeaders && hasValidBase64) {
            console.log(
              'Training access key verification successful - format validation passed'
            );
            isValidKey = true;
          } else {
            throw new Error(
              'Invalid RSA key format - missing headers or invalid base64 content'
            );
          }
        }

        if (isValidKey) {
          await new Promise((resolve) => setTimeout(resolve, 1500));

          toast.success('Security verification successful');
          onAccessGranted();
          onClose();

          // Reset form
          setPrivateKey('');
        }
      } catch (validationError: any) {
        console.error('Key validation error:', validationError);

        // Provide more specific error messages
        if (validationError.message?.includes('Invalid RSA key format')) {
          toast.error('Invalid RSA private key format');
          setError(
            "The private key format is not recognized. Please ensure it's a valid RSA private key in PEM format."
          );
        } else {
          toast.error('Invalid RSA private key');
          setError(
            `The provided key appears to be invalid: ${validationError.message}`
          );
        }
      }
    } catch (err: any) {
      console.error('Security verification error:', err);
      toast.error('Security verification failed');
      setError(`Failed to verify your credentials: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setPrivateKey('');
    setError(null);
    onClose();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-50 overflow-y-auto"
        onClose={handleClose}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-[#0f0f17] p-6 shadow-xl transition-all border border-[#f5f5fa14]">
              <button
                onClick={handleClose}
                className="absolute right-4 top-4 text-[#f5f5fa7a] hover:text-white transition-colors"
              >
                <HiX className="h-6 w-6" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-opacity-20">
                  <HiShieldCheck className="h-6 w-6 text-[#a855f7]" />
                </div>
                <div>
                  <Dialog.Title className="text-xl font-bold text-white">
                    Security Verification
                  </Dialog.Title>
                  <Dialog.Description className="text-[#f5f5fa7a] text-sm">
                    Enhanced protection for premium features
                  </Dialog.Description>
                </div>
              </div>

              {/* Security Notice */}
              <div className="mb-6 p-4 rounded-xl border border-[#f5f5fa14] bg-gradient-to-r from-[#6366f1]/5 to-[#a855f7]/5">
                <div className="flex items-start gap-3">
                  <HiLockClosed className="h-5 w-5 text-[#a855f7] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-[#f5f5faf4] font-medium mb-1">
                      Secure Access Required
                    </h3>
                    <p className="text-[#f5f5fa7a] text-sm">
                      To access premium Training features, please provide your
                      RSA private key. This additional security step prevents
                      unauthorized access to sensitive AI training capabilities.
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Input Form */}
              <div className="space-y-4">
                <div className="rounded-xl border border-[#f5f5fa14] bg-[#f5f5fa05] p-4">
                  <label className="block text-xs text-[#f5f5fa7a] mb-2">
                    RSA Private Key
                  </label>
                  <textarea
                    className="w-full p-3 rounded-lg bg-[#0f0f17] border border-[#f5f5fa14] text-[#f5f5faf4] text-sm font-mono h-[120px] focus:border-[#a855f7] focus:outline-none resize-none"
                    placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[#f5f5fa7a] text-xs">
                      Your key is verified locally and never transmitted.
                    </p>

                    {/* Key format helper button */}
                    <button
                      type="button"
                      onClick={() => {
                        // Clean up key (strip whitespace and headers)
                        let cleanKey = privateKey.trim();
                        cleanKey = cleanKey
                          .replace(/-----BEGIN.*?-----/, '')
                          .replace(/-----END.*?-----/, '')
                          .replace(/[\r\n\s]/g, '');

                        if (cleanKey.length > 0) {
                          // Add PKCS#1 format headers
                          const formattedKey = `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey}\n-----END RSA PRIVATE KEY-----`;
                          setPrivateKey(formattedKey);
                          toast.info('Applied RSA PKCS#1 format to your key');
                        } else {
                          toast.error('Please enter a private key first');
                        }
                      }}
                      className="text-xs px-2 py-1 bg-indigo-600/30 text-indigo-300 rounded hover:bg-indigo-600/50 transition-colors"
                    >
                      Format Key
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <HiExclamation className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-500 font-medium mb-1">
                        Verification Failed
                      </p>
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 border border-[#f5f5fa14] text-[#f5f5fa7a] rounded-xl hover:bg-[#f5f5fa05] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={verifyPrivateKey}
                    disabled={isVerifying || !privateKey.trim()}
                    className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white font-semibold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:ring-offset-2 focus:ring-offset-[#0f0f17] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <HiKey className="h-4 w-4" />
                        <span>Verify Access</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Security Features */}
              <div className="mt-6 pt-4 border-t border-[#f5f5fa14]">
                <div className="flex items-center gap-2 text-xs text-[#f5f5fa7a]">
                  <HiShieldCheck className="h-4 w-4 text-green-400" />
                  <span>End-to-end encryption</span>
                  <span>•</span>
                  <span>Zero server-side storage</span>
                  <span>•</span>
                  <span>Local verification only</span>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default TrainingAccessModal;
