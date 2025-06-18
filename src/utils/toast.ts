import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId?: string) => { // Make toastId optional
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss(); // Dismiss all toasts if no ID is provided
  }
};