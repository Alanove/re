namespace ShippingClientCSharp.CancelPickup
{
    partial class frmCancelPickup
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.gcClientInfo = new System.Windows.Forms.GroupBox();
            this.lblVersion = new System.Windows.Forms.Label();
            this.lblAccountEntity = new System.Windows.Forms.Label();
            this.lblAccountCountry = new System.Windows.Forms.Label();
            this.lblAccountPin = new System.Windows.Forms.Label();
            this.lblAccountNumber = new System.Windows.Forms.Label();
            this.lblPassword = new System.Windows.Forms.Label();
            this.lblUsername = new System.Windows.Forms.Label();
            this.txtVersion = new System.Windows.Forms.TextBox();
            this.txtAccountEntity = new System.Windows.Forms.TextBox();
            this.txtAccountCountryCode = new System.Windows.Forms.TextBox();
            this.txtAccountPin = new System.Windows.Forms.TextBox();
            this.txtAccountNumber = new System.Windows.Forms.TextBox();
            this.txtPassword = new System.Windows.Forms.TextBox();
            this.txtUsername = new System.Windows.Forms.TextBox();
            this.lblReference5 = new System.Windows.Forms.Label();
            this.gcTransaction = new System.Windows.Forms.GroupBox();
            this.lblReference4 = new System.Windows.Forms.Label();
            this.lblReference3 = new System.Windows.Forms.Label();
            this.lblReference2 = new System.Windows.Forms.Label();
            this.lblReference1 = new System.Windows.Forms.Label();
            this.txtReference5 = new System.Windows.Forms.TextBox();
            this.txtReference4 = new System.Windows.Forms.TextBox();
            this.txtReference3 = new System.Windows.Forms.TextBox();
            this.txtReference2 = new System.Windows.Forms.TextBox();
            this.txtReference1 = new System.Windows.Forms.TextBox();
            this.gcPickupReference = new System.Windows.Forms.GroupBox();
            this.lblComments = new System.Windows.Forms.Label();
            this.txtComments = new System.Windows.Forms.TextBox();
            this.lblPickupGUID = new System.Windows.Forms.Label();
            this.txtPickupGUID = new System.Windows.Forms.TextBox();
            this.btnReset = new System.Windows.Forms.Button();
            this.btnSubmitRequest = new System.Windows.Forms.Button();
            this.gcClientInfo.SuspendLayout();
            this.gcTransaction.SuspendLayout();
            this.gcPickupReference.SuspendLayout();
            this.SuspendLayout();
            // 
            // gcClientInfo
            // 
            this.gcClientInfo.Controls.Add(this.lblVersion);
            this.gcClientInfo.Controls.Add(this.lblAccountEntity);
            this.gcClientInfo.Controls.Add(this.lblAccountCountry);
            this.gcClientInfo.Controls.Add(this.lblAccountPin);
            this.gcClientInfo.Controls.Add(this.lblAccountNumber);
            this.gcClientInfo.Controls.Add(this.lblPassword);
            this.gcClientInfo.Controls.Add(this.lblUsername);
            this.gcClientInfo.Controls.Add(this.txtVersion);
            this.gcClientInfo.Controls.Add(this.txtAccountEntity);
            this.gcClientInfo.Controls.Add(this.txtAccountCountryCode);
            this.gcClientInfo.Controls.Add(this.txtAccountPin);
            this.gcClientInfo.Controls.Add(this.txtAccountNumber);
            this.gcClientInfo.Controls.Add(this.txtPassword);
            this.gcClientInfo.Controls.Add(this.txtUsername);
            this.gcClientInfo.Location = new System.Drawing.Point(10, 11);
            this.gcClientInfo.Name = "gcClientInfo";
            this.gcClientInfo.Size = new System.Drawing.Size(394, 198);
            this.gcClientInfo.TabIndex = 5;
            this.gcClientInfo.TabStop = false;
            this.gcClientInfo.Text = "ClientInfo";
            // 
            // lblVersion
            // 
            this.lblVersion.AutoSize = true;
            this.lblVersion.Location = new System.Drawing.Point(6, 174);
            this.lblVersion.Name = "lblVersion";
            this.lblVersion.Size = new System.Drawing.Size(45, 13);
            this.lblVersion.TabIndex = 12;
            this.lblVersion.Text = "Version:";
            // 
            // lblAccountEntity
            // 
            this.lblAccountEntity.AutoSize = true;
            this.lblAccountEntity.Location = new System.Drawing.Point(6, 147);
            this.lblAccountEntity.Name = "lblAccountEntity";
            this.lblAccountEntity.Size = new System.Drawing.Size(61, 13);
            this.lblAccountEntity.TabIndex = 10;
            this.lblAccountEntity.Text = "Acc. Entity:";
            // 
            // lblAccountCountry
            // 
            this.lblAccountCountry.AutoSize = true;
            this.lblAccountCountry.Location = new System.Drawing.Point(6, 122);
            this.lblAccountCountry.Name = "lblAccountCountry";
            this.lblAccountCountry.Size = new System.Drawing.Size(71, 13);
            this.lblAccountCountry.TabIndex = 8;
            this.lblAccountCountry.Text = "Acc. Country:";
            // 
            // lblAccountPin
            // 
            this.lblAccountPin.AutoSize = true;
            this.lblAccountPin.Location = new System.Drawing.Point(6, 96);
            this.lblAccountPin.Name = "lblAccountPin";
            this.lblAccountPin.Size = new System.Drawing.Size(50, 13);
            this.lblAccountPin.TabIndex = 6;
            this.lblAccountPin.Text = "Acc. Pin:";
            // 
            // lblAccountNumber
            // 
            this.lblAccountNumber.AutoSize = true;
            this.lblAccountNumber.Location = new System.Drawing.Point(6, 70);
            this.lblAccountNumber.Name = "lblAccountNumber";
            this.lblAccountNumber.Size = new System.Drawing.Size(52, 13);
            this.lblAccountNumber.TabIndex = 4;
            this.lblAccountNumber.Text = "Acc. No.:";
            // 
            // lblPassword
            // 
            this.lblPassword.AutoSize = true;
            this.lblPassword.Location = new System.Drawing.Point(6, 43);
            this.lblPassword.Name = "lblPassword";
            this.lblPassword.Size = new System.Drawing.Size(56, 13);
            this.lblPassword.TabIndex = 2;
            this.lblPassword.Text = "Password:";
            // 
            // lblUsername
            // 
            this.lblUsername.AutoSize = true;
            this.lblUsername.Location = new System.Drawing.Point(6, 18);
            this.lblUsername.Name = "lblUsername";
            this.lblUsername.Size = new System.Drawing.Size(58, 13);
            this.lblUsername.TabIndex = 0;
            this.lblUsername.Text = "Username:";
            // 
            // txtVersion
            // 
            this.txtVersion.Location = new System.Drawing.Point(78, 170);
            this.txtVersion.Name = "txtVersion";
            this.txtVersion.Size = new System.Drawing.Size(306, 20);
            this.txtVersion.TabIndex = 13;
            this.txtVersion.Text = "1.0";
            // 
            // txtAccountEntity
            // 
            this.txtAccountEntity.Location = new System.Drawing.Point(78, 144);
            this.txtAccountEntity.Name = "txtAccountEntity";
            this.txtAccountEntity.Size = new System.Drawing.Size(306, 20);
            this.txtAccountEntity.TabIndex = 11;
            this.txtAccountEntity.Text = "AMM";
            // 
            // txtAccountCountryCode
            // 
            this.txtAccountCountryCode.Location = new System.Drawing.Point(78, 118);
            this.txtAccountCountryCode.Name = "txtAccountCountryCode";
            this.txtAccountCountryCode.Size = new System.Drawing.Size(306, 20);
            this.txtAccountCountryCode.TabIndex = 9;
            this.txtAccountCountryCode.Text = "JO";
            // 
            // txtAccountPin
            // 
            this.txtAccountPin.Location = new System.Drawing.Point(78, 92);
            this.txtAccountPin.Name = "txtAccountPin";
            this.txtAccountPin.Size = new System.Drawing.Size(306, 20);
            this.txtAccountPin.TabIndex = 7;
            this.txtAccountPin.Text = "221321";
            // 
            // txtAccountNumber
            // 
            this.txtAccountNumber.Location = new System.Drawing.Point(78, 66);
            this.txtAccountNumber.Name = "txtAccountNumber";
            this.txtAccountNumber.Size = new System.Drawing.Size(306, 20);
            this.txtAccountNumber.TabIndex = 5;
            this.txtAccountNumber.Text = "20016";
            // 
            // txtPassword
            // 
            this.txtPassword.Location = new System.Drawing.Point(78, 40);
            this.txtPassword.Name = "txtPassword";
            this.txtPassword.Size = new System.Drawing.Size(306, 20);
            this.txtPassword.TabIndex = 3;
            this.txtPassword.Text = "123456789";
            // 
            // txtUsername
            // 
            this.txtUsername.Location = new System.Drawing.Point(78, 14);
            this.txtUsername.Name = "txtUsername";
            this.txtUsername.Size = new System.Drawing.Size(306, 20);
            this.txtUsername.TabIndex = 1;
            this.txtUsername.Text = "reem@reem.com";
            // 
            // lblReference5
            // 
            this.lblReference5.AutoSize = true;
            this.lblReference5.Location = new System.Drawing.Point(6, 122);
            this.lblReference5.Name = "lblReference5";
            this.lblReference5.Size = new System.Drawing.Size(66, 13);
            this.lblReference5.TabIndex = 8;
            this.lblReference5.Text = "Reference5:";
            // 
            // gcTransaction
            // 
            this.gcTransaction.Controls.Add(this.lblReference5);
            this.gcTransaction.Controls.Add(this.lblReference4);
            this.gcTransaction.Controls.Add(this.lblReference3);
            this.gcTransaction.Controls.Add(this.lblReference2);
            this.gcTransaction.Controls.Add(this.lblReference1);
            this.gcTransaction.Controls.Add(this.txtReference5);
            this.gcTransaction.Controls.Add(this.txtReference4);
            this.gcTransaction.Controls.Add(this.txtReference3);
            this.gcTransaction.Controls.Add(this.txtReference2);
            this.gcTransaction.Controls.Add(this.txtReference1);
            this.gcTransaction.Location = new System.Drawing.Point(10, 215);
            this.gcTransaction.Name = "gcTransaction";
            this.gcTransaction.Size = new System.Drawing.Size(394, 147);
            this.gcTransaction.TabIndex = 6;
            this.gcTransaction.TabStop = false;
            this.gcTransaction.Text = "Transaction";
            // 
            // lblReference4
            // 
            this.lblReference4.AutoSize = true;
            this.lblReference4.Location = new System.Drawing.Point(6, 96);
            this.lblReference4.Name = "lblReference4";
            this.lblReference4.Size = new System.Drawing.Size(66, 13);
            this.lblReference4.TabIndex = 6;
            this.lblReference4.Text = "Reference4:";
            // 
            // lblReference3
            // 
            this.lblReference3.AutoSize = true;
            this.lblReference3.Location = new System.Drawing.Point(6, 70);
            this.lblReference3.Name = "lblReference3";
            this.lblReference3.Size = new System.Drawing.Size(66, 13);
            this.lblReference3.TabIndex = 4;
            this.lblReference3.Text = "Reference3:";
            // 
            // lblReference2
            // 
            this.lblReference2.AutoSize = true;
            this.lblReference2.Location = new System.Drawing.Point(6, 44);
            this.lblReference2.Name = "lblReference2";
            this.lblReference2.Size = new System.Drawing.Size(66, 13);
            this.lblReference2.TabIndex = 2;
            this.lblReference2.Text = "Reference2:";
            // 
            // lblReference1
            // 
            this.lblReference1.AutoSize = true;
            this.lblReference1.Location = new System.Drawing.Point(6, 18);
            this.lblReference1.Name = "lblReference1";
            this.lblReference1.Size = new System.Drawing.Size(66, 13);
            this.lblReference1.TabIndex = 0;
            this.lblReference1.Text = "Reference1:";
            // 
            // txtReference5
            // 
            this.txtReference5.Location = new System.Drawing.Point(78, 118);
            this.txtReference5.Name = "txtReference5";
            this.txtReference5.Size = new System.Drawing.Size(310, 20);
            this.txtReference5.TabIndex = 9;
            // 
            // txtReference4
            // 
            this.txtReference4.Location = new System.Drawing.Point(78, 92);
            this.txtReference4.Name = "txtReference4";
            this.txtReference4.Size = new System.Drawing.Size(310, 20);
            this.txtReference4.TabIndex = 7;
            // 
            // txtReference3
            // 
            this.txtReference3.Location = new System.Drawing.Point(78, 66);
            this.txtReference3.Name = "txtReference3";
            this.txtReference3.Size = new System.Drawing.Size(310, 20);
            this.txtReference3.TabIndex = 5;
            // 
            // txtReference2
            // 
            this.txtReference2.Location = new System.Drawing.Point(78, 40);
            this.txtReference2.Name = "txtReference2";
            this.txtReference2.Size = new System.Drawing.Size(310, 20);
            this.txtReference2.TabIndex = 3;
            // 
            // txtReference1
            // 
            this.txtReference1.Location = new System.Drawing.Point(78, 14);
            this.txtReference1.Name = "txtReference1";
            this.txtReference1.Size = new System.Drawing.Size(310, 20);
            this.txtReference1.TabIndex = 1;
            // 
            // gcPickupReference
            // 
            this.gcPickupReference.Controls.Add(this.lblComments);
            this.gcPickupReference.Controls.Add(this.txtComments);
            this.gcPickupReference.Controls.Add(this.lblPickupGUID);
            this.gcPickupReference.Controls.Add(this.txtPickupGUID);
            this.gcPickupReference.Location = new System.Drawing.Point(10, 363);
            this.gcPickupReference.Name = "gcPickupReference";
            this.gcPickupReference.Size = new System.Drawing.Size(394, 99);
            this.gcPickupReference.TabIndex = 7;
            this.gcPickupReference.TabStop = false;
            this.gcPickupReference.Text = "Pickup";
            // 
            // lblComments
            // 
            this.lblComments.AutoSize = true;
            this.lblComments.Location = new System.Drawing.Point(6, 61);
            this.lblComments.Name = "lblComments";
            this.lblComments.Size = new System.Drawing.Size(59, 13);
            this.lblComments.TabIndex = 2;
            this.lblComments.Text = "Comments:";
            // 
            // txtComments
            // 
            this.txtComments.Location = new System.Drawing.Point(78, 41);
            this.txtComments.MaxLength = 250;
            this.txtComments.Multiline = true;
            this.txtComments.Name = "txtComments";
            this.txtComments.Size = new System.Drawing.Size(310, 52);
            this.txtComments.TabIndex = 3;
            // 
            // lblPickupGUID
            // 
            this.lblPickupGUID.AutoSize = true;
            this.lblPickupGUID.Location = new System.Drawing.Point(6, 19);
            this.lblPickupGUID.Name = "lblPickupGUID";
            this.lblPickupGUID.Size = new System.Drawing.Size(37, 13);
            this.lblPickupGUID.TabIndex = 0;
            this.lblPickupGUID.Text = "GUID:";
            // 
            // txtPickupGUID
            // 
            this.txtPickupGUID.Location = new System.Drawing.Point(78, 15);
            this.txtPickupGUID.MaxLength = 100;
            this.txtPickupGUID.Name = "txtPickupGUID";
            this.txtPickupGUID.Size = new System.Drawing.Size(310, 20);
            this.txtPickupGUID.TabIndex = 1;
            // 
            // btnReset
            // 
            this.btnReset.Location = new System.Drawing.Point(320, 468);
            this.btnReset.Name = "btnReset";
            this.btnReset.Size = new System.Drawing.Size(84, 23);
            this.btnReset.TabIndex = 9;
            this.btnReset.Text = "Reset";
            this.btnReset.UseVisualStyleBackColor = true;
            this.btnReset.Click += new System.EventHandler(this.btnReset_Click);
            // 
            // btnSubmitRequest
            // 
            this.btnSubmitRequest.Location = new System.Drawing.Point(223, 468);
            this.btnSubmitRequest.Name = "btnSubmitRequest";
            this.btnSubmitRequest.Size = new System.Drawing.Size(91, 23);
            this.btnSubmitRequest.TabIndex = 8;
            this.btnSubmitRequest.Text = "Submit Request";
            this.btnSubmitRequest.UseVisualStyleBackColor = true;
            this.btnSubmitRequest.Click += new System.EventHandler(this.btnSubmitRequest_Click);
            // 
            // frmCancelPickup
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(415, 503);
            this.Controls.Add(this.gcClientInfo);
            this.Controls.Add(this.gcTransaction);
            this.Controls.Add(this.gcPickupReference);
            this.Controls.Add(this.btnReset);
            this.Controls.Add(this.btnSubmitRequest);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.Name = "frmCancelPickup";
            this.ShowInTaskbar = false;
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterParent;
            this.Text = "Shipping API - Shipping Client - Pickup Cancelation Service";
            this.gcClientInfo.ResumeLayout(false);
            this.gcClientInfo.PerformLayout();
            this.gcTransaction.ResumeLayout(false);
            this.gcTransaction.PerformLayout();
            this.gcPickupReference.ResumeLayout(false);
            this.gcPickupReference.PerformLayout();
            this.ResumeLayout(false);

        }

        #endregion

        internal System.Windows.Forms.GroupBox gcClientInfo;
        internal System.Windows.Forms.Label lblVersion;
        internal System.Windows.Forms.Label lblAccountEntity;
        internal System.Windows.Forms.Label lblAccountCountry;
        internal System.Windows.Forms.Label lblAccountPin;
        internal System.Windows.Forms.Label lblAccountNumber;
        internal System.Windows.Forms.Label lblPassword;
        internal System.Windows.Forms.Label lblUsername;
        internal System.Windows.Forms.TextBox txtVersion;
        internal System.Windows.Forms.TextBox txtAccountEntity;
        internal System.Windows.Forms.TextBox txtAccountCountryCode;
        internal System.Windows.Forms.TextBox txtAccountPin;
        internal System.Windows.Forms.TextBox txtAccountNumber;
        internal System.Windows.Forms.TextBox txtPassword;
        internal System.Windows.Forms.TextBox txtUsername;
        internal System.Windows.Forms.Label lblReference5;
        internal System.Windows.Forms.GroupBox gcTransaction;
        internal System.Windows.Forms.Label lblReference4;
        internal System.Windows.Forms.Label lblReference3;
        internal System.Windows.Forms.Label lblReference2;
        internal System.Windows.Forms.Label lblReference1;
        internal System.Windows.Forms.TextBox txtReference5;
        internal System.Windows.Forms.TextBox txtReference4;
        internal System.Windows.Forms.TextBox txtReference3;
        internal System.Windows.Forms.TextBox txtReference2;
        internal System.Windows.Forms.TextBox txtReference1;
        internal System.Windows.Forms.GroupBox gcPickupReference;
        internal System.Windows.Forms.Label lblComments;
        internal System.Windows.Forms.TextBox txtComments;
        internal System.Windows.Forms.Label lblPickupGUID;
        internal System.Windows.Forms.TextBox txtPickupGUID;
        internal System.Windows.Forms.Button btnReset;
        internal System.Windows.Forms.Button btnSubmitRequest;
    }
}