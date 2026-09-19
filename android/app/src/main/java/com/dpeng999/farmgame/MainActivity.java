package com.dpeng999.farmgame;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * 《口袋小农场》Android 壳：全屏竖屏 WebView 加载本地离线游戏（assets/game）。
 * - 关闭缩放/长按选择；开启 DOM Storage 以保存存档
 * - 返回键交给游戏处理（关弹窗 → 回农场页），未处理时双击退出
 */
public class MainActivity extends Activity {

    private WebView web;
    private long lastBackTime = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);
        s.setLoadWithOverviewMode(false);
        s.setUseWideViewPort(false);
        web.setBackgroundColor(0xFFBFE8FF);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        web.setWebViewClient(new WebViewClient());
        web.loadUrl("file:///android_asset/game/index.html");

        // 适配全面屏：内容延伸到系统栏下方（页面自带 safe-area padding）
        web.setFitsSystemWindows(false);
        setContentView(web);
    }

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript(
                "(function(){try{return window.AndroidBack?window.AndroidBack():false}catch(e){return false}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        boolean handled = "true".equals(value);
                        if (handled) return;
                        long now = System.currentTimeMillis();
                        if (now - lastBackTime < 2000) {
                            MainActivity.super.onBackPressed();
                        } else {
                            lastBackTime = now;
                            Toast.makeText(MainActivity.this, "再按一次退出游戏", Toast.LENGTH_SHORT).show();
                        }
                    }
                });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
