const ADMIN_BACKEND_BASE_URL = "http://localhost:4000";

async function createVipCoupon(code, expiresInDays = 90, button) {
  const couponCode = String(code || "").trim().toUpperCase();

  if (!couponCode) {
    alert("Coupon code likho pehle.");
    return;
  }

  setLoading?.(button, true);

  try {
    const response = await fetch(`${ADMIN_BACKEND_BASE_URL}/vip-coupons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: couponCode,
        expiresInDays: Number(expiresInDays) || 90,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Coupon create failed");
    }

    alert(`Coupon created: ${result.coupon?.code || couponCode}`);
    await loadVipCoupons();
  } catch (error) {
    console.error("Create VIP coupon failed", error);
    alert(error.message || "Coupon create failed");
  } finally {
    setLoading?.(button, false);
  }
}

async function disableVipCoupon(code, button) {
  const couponCode = String(code || "").trim().toUpperCase();

  if (!couponCode) {
    alert("Coupon code missing hai.");
    return;
  }

  setLoading?.(button, true);

  try {
    const response = await fetch(
      `${ADMIN_BACKEND_BASE_URL}/vip-coupons/${encodeURIComponent(
        couponCode
      )}/disable`,
      {
        method: "POST",
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Coupon disable failed");
    }

    alert(`Coupon disabled: ${result.coupon?.code || couponCode}`);
    await loadVipCoupons();
  } catch (error) {
    console.error("Disable VIP coupon failed", error);
    alert(error.message || "Coupon disable failed");
  } finally {
    setLoading?.(button, false);
  }
}

async function enableVipCoupon(code, button) {
  const couponCode = String(code || "").trim().toUpperCase();

  if (!couponCode) {
    alert("Coupon code missing hai.");
    return;
  }

  setLoading?.(button, true);

  try {
    const response = await fetch(
      `${ADMIN_BACKEND_BASE_URL}/vip-coupons/${encodeURIComponent(
        couponCode
      )}/enable`,
      {
        method: "POST",
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Coupon enable failed");
    }

    alert(`Coupon enabled: ${result.coupon?.code || couponCode}`);
    await loadVipCoupons();
  } catch (error) {
    console.error("Enable VIP coupon failed", error);
    alert(error.message || "Coupon enable failed");
  } finally {
    setLoading?.(button, false);
  }
}

async function loadVipCoupons() {
  try {
    const response = await fetch(`${ADMIN_BACKEND_BASE_URL}/vip-coupons`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Coupon list load failed");
    }

    console.table(result.coupons || []);
    return result.coupons || [];
  } catch (error) {
    console.error("Load VIP coupons failed", error);
    alert(error.message || "Coupon list load failed");
    return [];
  }
}
