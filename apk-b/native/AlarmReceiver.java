package com.schedule.b;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * AlarmManager 到点后触发：发送一条“全屏意图”高优先级通知，唤起 AlarmActivity（锁屏/前台其它 App 也能弹）。
 */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra("id", 0);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String channelId = "alarm_reminders";

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/raw/schedule_alarm");
            NotificationChannel ch = new NotificationChannel(channelId, "日程提醒", NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 600, 300, 600});
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            ch.setSound(sound, aa);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }

        Intent alarm = new Intent(context, AlarmActivity.class);
        alarm.putExtra("title", title);
        alarm.putExtra("body", body);
        alarm.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        PendingIntent pi = PendingIntent.getActivity(context, id, alarm,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            b = new Notification.Builder(context, channelId);
        } else {
            b = new Notification.Builder(context);
        }
        b.setSmallIcon(context.getApplicationInfo().icon)
                .setContentTitle(title == null ? "日程提醒" : title)
                .setContentText(body == null ? "" : body)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVibrate(new long[]{0, 600, 300, 600})
                .setFullScreenIntent(pi, true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) b.setPriority(Notification.PRIORITY_MAX);

        try { nm.notify(id, b.build()); } catch (Exception e) {}
    }
}
