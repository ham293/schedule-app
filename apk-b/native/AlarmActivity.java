package com.schedule.b;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * 全屏闹钟界面：到点后从锁屏/其它 App 上方弹出，一直响铃 + 震动，点「知道了」关闭。
 */
public class AlarmActivity extends Activity {
    private Ringtone ringtone;
    private Vibrator vibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        String title = getIntent().getStringExtra("title");
        String body = getIntent().getStringExtra("body");
        if (title == null) title = "日程提醒";
        if (body == null) body = "";

        // 布局
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(0xFF1D2138);

        TextView emoji = new TextView(this);
        emoji.setText("⏰");
        emoji.setTextSize(64f);
        emoji.setGravity(Gravity.CENTER);
        root.addView(emoji, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1.2f));

        TextView tTitle = new TextView(this);
        tTitle.setText(title);
        tTitle.setTextColor(Color.WHITE);
        tTitle.setTextSize(26f);
        tTitle.setTypeface(Typeface.DEFAULT_BOLD);
        tTitle.setGravity(Gravity.CENTER);
        tTitle.setPadding(40, 20, 40, 10);
        root.addView(tTitle);

        TextView tBody = new TextView(this);
        tBody.setText(body);
        tBody.setTextColor(0xFFBBC0D5);
        tBody.setTextSize(18f);
        tBody.setGravity(Gravity.CENTER);
        tBody.setPadding(40, 0, 40, 20);
        root.addView(tBody, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 0.8f));

        Button btn = new Button(this);
        btn.setText("知道了");
        btn.setTextSize(18f);
        btn.setAllCaps(false);
        btn.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 140);
        lp.setMargins(40, 0, 40, 60);
        btn.setLayoutParams(lp);
        root.addView(btn);

        setContentView(root);

        // 响铃（使用打包的闹钟铃声，USAGE_ALARM 走闹钟音量）
        try {
            Uri sound = Uri.parse("android.resource://" + getPackageName() + "/raw/schedule_alarm");
            RingtoneManager rm = new RingtoneManager(this);
            Ringtone r = RingtoneManager.getRingtone(this, sound);
            if (r != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    r.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build());
                }
                ringtone = r;
                r.play();
            }
        } catch (Exception e) {}

        // 震动
        try {
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            vibrator.vibrate(800L);
        } catch (Exception e) {}
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (ringtone != null) try { ringtone.stop(); } catch (Exception e) {}
        if (vibrator != null) try { vibrator.cancel(); } catch (Exception e) {}
    }
}
